import logging

from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from django.utils import timezone
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from rest_framework_simplejwt.authentication import JWTAuthentication
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from ..counter_broadcast import build_counter_read_reset_event
from ..message_service import create_chat_message
from ..models import Chat, ChatReadStatus
from ..unread_utils import (
    unread_counts_for_user_in_chats,
    unread_message_count_for_participant,
)
from .serializers import (
    ChatPartnerSearchSerializer,
    ChatSerializer,
    MessageSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class AmbiguousChatTargetError(Exception):
    """Кілька користувачів підходять під нечіткий запит (наприклад icontains)."""

    def __init__(self, needle: str):
        self.needle = needle


def _parse_chat_target(value) -> str:
    """Нормалізує введення з модалки / API: @nick, id, email, число з JSON."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return ""
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else ""
    if not isinstance(value, str):
        return ""
    s = value.strip()
    if s.startswith("@"):
        s = s[1:].strip()
    return s


def _resolve_user_for_chat(needle: str):
    """
    Пошук за логіном, ніком профілю, email (User/Profile), числовим pk.
    Якщо точних збігів немає — один нечіткий збіг (icontains), як у user-search.
    Кілька збігів → AmbiguousChatTargetError.
    """
    if not needle:
        return None
    base = User.objects.select_related("profile")

    u = base.filter(username__iexact=needle).first()
    if u is not None:
        return u
    u = base.filter(profile__username__iexact=needle).first()
    if u is not None:
        return u

    if "@" in needle:
        normalized = User.objects.normalize_email(needle)
        for em in (normalized, needle.strip()):
            if not em:
                continue
            u = base.filter(email__iexact=em).first()
            if u is not None:
                return u
            u = base.filter(profile__email__iexact=em).first()
            if u is not None:
                return u

    if needle.isdigit():
        return base.filter(pk=int(needle)).first()

    # Як user-search: частковий збіг по логіну / ніку в профілі (однозначно)
    if len(needle) >= 2:
        fuzzy = base.filter(
            Q(username__icontains=needle) | Q(profile__username__icontains=needle)
        ).distinct()
        sample = list(fuzzy[:2])
        if len(sample) == 1:
            return sample[0]
        if len(sample) == 2:
            raise AmbiguousChatTargetError(needle)
    return None


class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle, UserRateThrottle]

    def get_throttle_scope(self):
        if self.action == "user_search":
            return "chat_user_search"
        if self.action == "create_chat":
            return "chat_create"
        return "read_heavy"

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            raise AuthenticationFailed("User not authenticated")
        # distinct() — на випадок рідкісних дублікатів при складних join через M2M
        return Chat.objects.filter(participants=self.request.user).distinct()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        pk = self.kwargs.get("pk")
        if pk and self.request.user.is_authenticated:
            try:
                cid = int(pk)
                if self.action in ("retrieve", "update", "partial_update"):
                    ctx["unread_by_chat_id"] = {
                        cid: unread_message_count_for_participant(
                            cid, self.request.user.id
                        )
                    }
            except (TypeError, ValueError):
                pass
        return ctx

    def list(self, request, *args, **kwargs):
        queryset = self._chat_queryset_optimized()
        chats = list(queryset)
        ids = [c.id for c in chats]
        unread_map = unread_counts_for_user_in_chats(ids, request.user.id)
        serializer = self.get_serializer(
            chats,
            many=True,
            context={
                **self.get_serializer_context(),
                "unread_by_chat_id": unread_map,
            },
        )
        return Response(serializer.data)

    def _chat_queryset_optimized(self):
        return self.get_queryset().select_related(
            "last_message__sender__profile",
        ).prefetch_related(
            Prefetch(
                "participants",
                queryset=User.objects.select_related("profile"),
            ),
        )

    @action(detail=False, methods=["get"], url_path="user-search")
    def user_search(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"results": []})
        base = (
            User.objects.select_related("profile")
            .filter(is_active=True)
            .exclude(pk=request.user.pk)
        )
        users = base.filter(
            Q(username__icontains=q) | Q(profile__username__icontains=q)
        ).distinct()[:15]
        ser = ChatPartnerSearchSerializer(users, many=True)
        return Response({"results": ser.data})

    @action(detail=False, methods=["post"])
    def create_chat(self, request):
        if not request.user.is_authenticated:
            raise AuthenticationFailed("User not authenticated")

        logger.debug("Create chat request from user: %s", request.user)
        logger.debug(
            "Request data keys: %s",
            list(request.data.keys()) if hasattr(request.data, "keys") else "",
        )

        message = request.data.get("message")
        raw = _parse_chat_target(request.data.get("username"))
        if not raw:
            raw = _parse_chat_target(request.data.get("user"))
        if not raw:
            return Response(
                {"error": "Вкажіть логін, нік, email або числовий id користувача"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            try:
                other_user = _resolve_user_for_chat(raw)
            except AmbiguousChatTargetError:
                return Response(
                    {
                        "error": (
                            f"За запитом «{raw}» знайдено кількох користувачів. "
                            "Укажіть точніший логін, email або id."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if other_user is None:
                raise User.DoesNotExist()
            if other_user.pk == request.user.pk:
                return Response(
                    {"error": "Неможливо створити чат з самим собою"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            logger.debug("Found other user: %s", other_user)

            existing_pk = None
            new_chat_instance = None
            with transaction.atomic():
                for uid in sorted([request.user.pk, other_user.pk]):
                    User.objects.select_for_update().get(pk=uid)
                found = (
                    Chat.objects.filter(participants=request.user)
                    .filter(participants=other_user)
                    .first()
                )
                if found is not None:
                    existing_pk = found.pk
                else:
                    c = Chat.objects.create()
                    c.participants.add(request.user, other_user)
                    new_chat_instance = c

            if existing_pk is not None:
                chat_existing = (
                    self._chat_queryset_optimized()
                    .filter(pk=existing_pk)
                    .first()
                ) or Chat.objects.get(pk=existing_pk)
                if message and chat_existing:
                    try:
                        create_chat_message(
                            chat_id=chat_existing.pk,
                            sender=request.user,
                            content=str(message),
                        )
                    except ValueError as e:
                        return Response(
                            {"error": str(e)},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    except PermissionError:
                        return Response(
                            {"error": "Немає доступу до чату"},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                    chat_existing = (
                        self._chat_queryset_optimized()
                        .filter(pk=existing_pk)
                        .first()
                    ) or chat_existing
                umap = {
                    chat_existing.pk: unread_message_count_for_participant(
                        chat_existing.pk, request.user.id
                    )
                }
                return Response(
                    self.serializer_class(
                        chat_existing,
                        context={
                            **self.get_serializer_context(),
                            "unread_by_chat_id": umap,
                        },
                    ).data,
                    status=status.HTTP_200_OK,
                )

            chat = new_chat_instance

            if message:
                try:
                    create_chat_message(
                        chat_id=chat.pk,
                        sender=request.user,
                        content=str(message),
                    )
                except ValueError as e:
                    return Response(
                        {"error": str(e)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                except PermissionError:
                    return Response(
                        {"error": "Немає доступу до чату"},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                chat = (
                    self._chat_queryset_optimized().filter(pk=chat.pk).first()
                ) or chat

            logger.debug("Created chat id=%s", chat.id)
            umap = {
                chat.pk: unread_message_count_for_participant(
                    chat.pk, request.user.id
                )
            }
            return Response(
                self.serializer_class(
                    chat,
                    context={
                        **self.get_serializer_context(),
                        "unread_by_chat_id": umap,
                    },
                ).data,
                status=status.HTTP_201_CREATED,
            )
        except User.DoesNotExist:
            logger.warning(
                "create_chat: user not found needle=%r requester=%s keys=%s",
                raw,
                getattr(request.user, "pk", None),
                list(request.data.keys()) if hasattr(request.data, "keys") else None,
            )
            return Response(
                {
                    "error": (
                        f"Користувач «{raw}» не знайдений "
                        "(логін, нік у профілі, email або id). Перевірте написання."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.error("Error creating chat: %s", e, exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def send_message(self, request, pk=None):
        if not request.user.is_authenticated:
            raise AuthenticationFailed("User not authenticated")

        chat = self.get_object()
        content = request.data.get("content")

        if not content:
            return Response(
                {"error": "Повідомлення не може бути порожнім"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            message = create_chat_message(
                chat_id=chat.pk, sender=request.user, content=str(content)
            )
            serializer = MessageSerializer(message)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionError:
            return Response(
                {"error": "Немає доступу до чату"},
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception as e:
            logger.error("Error sending message: %s", e, exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        chat = self.get_object()
        try:
            limit = int(request.query_params.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 100))
        before_raw = request.query_params.get("before")
        before_id = None
        if before_raw is not None and before_raw != "":
            try:
                before_id = int(before_raw)
            except (TypeError, ValueError):
                return Response(
                    {"error": "Некоректний параметр before"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        qs = chat.messages.select_related("sender__profile").order_by("-id")
        if before_id is not None:
            qs = qs.filter(id__lt=before_id)

        batch = list(qs[: limit + 1])
        has_more = len(batch) > limit
        batch = batch[:limit]
        batch.reverse()

        next_before = batch[0].id if batch and has_more else None
        data = MessageSerializer(batch, many=True).data
        return Response({"results": data, "next_before": next_before})

    @action(detail=True, methods=["post"])
    def mark_as_read(self, request, pk=None):
        """Отмечает чат как прочитанный пользователем"""
        if not request.user.is_authenticated:
            raise AuthenticationFailed("User not authenticated")

        chat = self.get_object()

        read_status, created = ChatReadStatus.objects.get_or_create(
            chat=chat,
            user=request.user,
            defaults={"last_read_at": timezone.now()},
        )

        if not created:
            read_status.last_read_at = timezone.now()
            read_status.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"counter_{request.user.id}",
            build_counter_read_reset_event(
                chat_id=chat.id,
                username=request.user.username,
                timestamp_iso=read_status.last_read_at.isoformat(),
            ),
        )

        return Response(
            {
                "message": "Чат отмечен как прочитанный",
                "last_read_at": read_status.last_read_at,
            }
        )

    def destroy(self, request, *args, **kwargs):
        chat = self.get_object()
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{chat.id}",
            {"type": "chat_deleted"},
        )
        chat.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
