import logging
import threading

from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.authentication import JWTAuthentication

from ..models import SupportTicket
from ..services import (
    SupportAttachmentError,
    delete_attachment_files,
    get_client_ip,
    is_duplicate_submission,
    mark_submission_dedupe,
    notify_staff_new_ticket,
    save_attachments,
)
from .serializers import SupportTicketCreateSerializer

logger = logging.getLogger(__name__)


@method_decorator(csrf_protect, name="dispatch")
class SupportTicketCreateView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [JWTAuthentication]
    # ScopedRateThrottle: авторизований — ключ за user.pk, анонім — за IP.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "support_ticket"
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        serializer = SupportTicketCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        user = request.user if request.user.is_authenticated else None

        if user:
            email = (user.email or "").strip()
            if not email:
                return Response(
                    {
                        "error": "У вашому профілі не вказано email. Додайте email у налаштуваннях профілю.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Ім'я лише з облікового запису (поле на фронті лише для перегляду).
            name = user.username
        else:
            email = data["email"].strip()
            name = data["name"].strip()

        if is_duplicate_submission(email, data["message"]):
            logger.warning(
                "Support duplicate blocked: email=%s ip=%s",
                email,
                get_client_ip(request),
            )
            return Response(
                {
                    "error": "Схоже, це звернення вже надіслано. Зачекайте кілька хвилин або змініть текст.",
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        referer = (request.META.get("HTTP_REFERER") or "")[:512]
        ua = (request.META.get("HTTP_USER_AGENT") or "")[:512]

        files = []
        if hasattr(request, "FILES"):
            files = request.FILES.getlist("attachments")

        saved_attachments: list = []
        ticket: SupportTicket | None = None
        try:
            with transaction.atomic():
                ticket = SupportTicket(
                    user=user,
                    name=name,
                    email=email,
                    subject=data["subject"],
                    category=data["category"],
                    message=data["message"],
                    status=SupportTicket.Status.NEW,
                    priority=SupportTicket.Priority.NORMAL,
                    source="support_page",
                    ip_address=get_client_ip(request),
                    user_agent=ua,
                    http_referer=referer,
                    submitted_page_url=data.get("page_url") or "",
                )
                ticket.full_clean()
                ticket.save()

                saved_attachments = save_attachments(ticket, files)

        except SupportAttachmentError as e:
            delete_attachment_files(saved_attachments)
            return Response(
                {"attachments": [str(e)]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            delete_attachment_files(saved_attachments)
            logger.exception("Support ticket create failed")
            return Response(
                {"error": "Не вдалося зберегти звернення. Спробуйте пізніше."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        assert ticket is not None

        ticket_pk = ticket.pk
        commit_email = email
        commit_message = data["message"]

        def _after_commit(pk: int, em: str, msg: str) -> None:
            mark_submission_dedupe(em, msg)

            def _notify_and_log() -> None:
                try:
                    t = SupportTicket.objects.get(pk=pk)
                    notify_staff_new_ticket(t)
                except SupportTicket.DoesNotExist:
                    logger.error("Support ticket pk=%s missing for notify", pk)
                except Exception:
                    logger.exception("Staff notify failed for ticket pk=%s", pk)

            threading.Thread(target=_notify_and_log, daemon=True).start()

        transaction.on_commit(
            lambda: _after_commit(ticket_pk, commit_email, commit_message)
        )

        return Response(
            {
                "ticket_number": ticket.ticket_number,
                "message": "Звернення успішно надіслано. Ми зв'яжемося з вами на вказаний email.",
            },
            status=status.HTTP_201_CREATED,
        )
