import logging
from decimal import Decimal
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from dateutil import parser

from .serializers import AdvertisementSerializer, AdvertisementOrderSerializer
from ..models import Advertisement
from .. import services
from apps.catalog.models import Book
from apps.core.smart_throttling import SmartThrottle

logger = logging.getLogger(__name__)


def _location_label(ad: Advertisement) -> str:
    loc = dict(Advertisement.LOCATION_CHOICES).get(ad.location, ad.location)
    if ad.location == "search" and ad.target_kind != "none":
        kind = dict(Advertisement.TARGET_KIND_CHOICES).get(ad.target_kind, ad.target_kind)
        return f"{loc} ({kind} #{ad.target_id})"
    return loc


class AdvertisementViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Створення реклами лише через POST .../submit_order/ (атомарний сценарій).
    Стандартний POST create вимкнено — немає CreateModelMixin.
    """

    serializer_class = AdvertisementSerializer
    queryset = Advertisement.objects.all()

    def get_permissions(self):
        if self.action in [
            "main_page_ads",
            "catalog_page_ads",
            "public",
            "search_ads",
        ]:
            return []
        return [IsAuthenticated()]

    def get_throttle_scope(self):
        if self.action in [
            "list",
            "retrieve",
            "main_page_ads",
            "catalog_page_ads",
            "public",
            "search_ads",
            "book_advertisements",
        ]:
            if SmartThrottle.is_suspicious_request(self.request):
                return "rating"
            return "read_light"
        elif self.action in ["update", "partial_update", "destroy", "submit_order"]:
            return "purchase"
        return None

    def get_queryset(self):
        if self.action in ["list", "retrieve", "user_advertisements"]:
            logger.info(f"Отримання реклами для користувача: {self.request.user.id}")
            return Advertisement.objects.filter(user=self.request.user)
        return Advertisement.objects.all()

    @action(detail=False, methods=["post"])
    def calculate_cost(self, request):
        try:
            current_date = timezone.now().date()
            start_date_str = request.data.get("start_date")
            end_date_str = request.data.get("end_date")
            location = request.data.get("location", "main")
            target_kind = request.data.get("target_kind", "none")

            if not start_date_str or not end_date_str:
                return Response(
                    {"error": "Потрібні start_date та end_date"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            start_date = parser.parse(start_date_str).date()
            end_date = parser.parse(end_date_str).date()

            if location in ("main", "catalog"):
                target_kind = "none"

            services.validate_dates_for_new_campaign(
                start_date, end_date, reference_date=current_date
            )

            total_cost = services.calc_total_cost(
                location, start_date, end_date, target_kind
            )
            days = services.calc_days_inclusive(start_date, end_date)
            cost_per_day = services.price_per_day(location, target_kind)

            return Response(
                {
                    "total_cost": float(total_cost),
                    "days": days,
                    "cost_per_day": float(cost_per_day),
                }
            )
        except DjangoValidationError as e:
            msg = e.messages if hasattr(e, "messages") else [str(e)]
            return Response(
                {"error": msg[0] if msg else str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Помилка в calculate_cost: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def submit_order(self, request):
        """Атомарне створення всього замовлення реклами — єдиний офіційний шлях створення."""
        serializer = AdvertisementOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data["items"]
        user = request.user
        profile = user.profile
        current_date = timezone.now().date()
        book_id = items[0]["book"]

        from apps.monitoring.models import AdvertisingLog
        from apps.notification.models import Notification

        with transaction.atomic():
            try:
                book = Book.objects.select_for_update().get(pk=book_id)
            except Book.DoesNotExist:
                raise serializers.ValidationError("Книгу не знайдено")

            if book.owner_id != user.id:
                raise serializers.ValidationError(
                    "У вас немає прав для реклами цієї книги"
                )

            profile = type(profile).objects.select_for_update().get(pk=profile.pk)

            total_order_cost = Decimal("0.00")
            prepared_items = []

            for item in items:
                start_date = item["start_date"]
                end_date = item["end_date"]
                location = item["location"]
                target_kind = item.get("target_kind") or "none"
                target_id = item.get("target_id")

                if location in ("main", "catalog"):
                    target_kind = "none"
                    target_id = None

                try:
                    services.validate_dates_for_new_campaign(
                        start_date, end_date, reference_date=current_date
                    )
                except DjangoValidationError as e:
                    msg = e.messages if hasattr(e, "messages") else [str(e)]
                    raise serializers.ValidationError(msg[0] if msg else str(e))

                try:
                    services.validate_location_target_pair(
                        location, target_kind, target_id
                    )
                except DjangoValidationError as e:
                    msg = e.messages if hasattr(e, "messages") else [str(e)]
                    raise serializers.ValidationError(msg[0] if msg else str(e))

                try:
                    services.assert_no_overlap(
                        book, location, target_kind, target_id, start_date, end_date
                    )
                except DjangoValidationError as e:
                    msg = e.messages if hasattr(e, "messages") else [str(e)]
                    raise serializers.ValidationError(msg[0] if msg else str(e))

                item_cost = services.calc_total_cost(
                    location, start_date, end_date, target_kind
                )
                total_order_cost += item_cost
                prepared_items.append(
                    {
                        "book": book,
                        "location": location,
                        "target_kind": target_kind,
                        "target_id": target_id,
                        "start_date": start_date,
                        "end_date": end_date,
                        "total_cost": item_cost,
                    }
                )

            if profile.balance < total_order_cost:
                raise serializers.ValidationError(
                    {
                        "error": "Недостатньо коштів на балансі",
                        "balance": float(profile.balance),
                        "required": float(total_order_cost),
                    }
                )

            profile.balance_operation(total_order_cost, "advertising")

            created_ads = []
            for item in prepared_items:
                ad = Advertisement.objects.create(
                    user=user,
                    book=item["book"],
                    location=item["location"],
                    target_kind=item["target_kind"],
                    target_id=item["target_id"],
                    start_date=item["start_date"],
                    end_date=item["end_date"],
                    total_cost=item["total_cost"],
                    is_active=True,
                )
                created_ads.append(ad)

                AdvertisingLog.objects.create(
                    user=user,
                    book=item["book"],
                    location=item["location"],
                    target_kind=item["target_kind"],
                    target_id=item["target_id"],
                    start_date=item["start_date"],
                    end_date=item["end_date"],
                    total_cost=item["total_cost"],
                )

                message = (
                    f"Увага! Ви замовили рекламу ({_location_label(ad)}) "
                    f"для книги '{item['book'].title}' на період з "
                    f"{item['start_date']} по {item['end_date']} "
                    f"на суму {item['total_cost']} FanCoins!"
                )
                Notification.objects.create(
                    user=user,
                    book=item["book"],
                    message=message,
                    is_read=False,
                )

            result = AdvertisementSerializer(created_ads, many=True)
            return Response(result.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def book_advertisements(self, request):
        """Реклама книги (фільтр по book_id у query params)."""
        book_id = request.query_params.get("book")
        qs = Advertisement.objects.filter(user=request.user)

        if book_id:
            try:
                qs = qs.filter(book_id=int(book_id))
            except (ValueError, TypeError):
                pass

        qs = qs.select_related("book").order_by("-created_at")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def _active_surface_qs(self, location: str):
        current_date = timezone.now().date()
        q = self.queryset.filter(
            start_date__lte=current_date,
            end_date__gte=current_date,
            location=location,
            is_active=True,
        )
        if location in ("main", "catalog"):
            q = q.filter(target_kind="none", target_id__isnull=True)
        return q.select_related("book")

    @action(detail=False, methods=["get"])
    def main_page_ads(self, request):
        logger.info("Отримання реклами для головної сторінки...")
        try:
            ads = self._active_surface_qs("main")
            serializer = self.get_serializer(ads, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Помилка в main_page_ads: {str(e)}", exc_info=True)
            raise

    @action(detail=False, methods=["get"])
    def catalog_page_ads(self, request):
        logger.info("Отримання реклами для сторінки каталогу...")
        try:
            ads = self._active_surface_qs("catalog")
            serializer = self.get_serializer(ads, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Помилка в catalog_page_ads: {str(e)}", exc_info=True)
            raise

    @action(detail=False, methods=["get"])
    def public(self, request):
        """GET ?location=main|catalog — публічна видача для поверхні (без пошуку)."""
        loc = request.query_params.get("location", "").strip()
        if loc not in ("main", "catalog"):
            return Response(
                {"error": "Потрібен параметр location=main або catalog"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ads = self._active_surface_qs(loc)
        serializer = self.get_serializer(ads, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def search_ads(self, request):
        """
        Реклама пошуку з ранжуванням за фільтрами (окремий сценарій від main/catalog).
        GET ?genre_ids=1,2&tag_ids=3&fandom_ids=4
        """
        def parse_ids(name):
            raw = request.query_params.get(name, "") or ""
            if not raw.strip():
                return []
            out = []
            for part in raw.split(","):
                part = part.strip()
                if not part:
                    continue
                try:
                    out.append(int(part))
                except ValueError:
                    pass
            return out

        genre_ids = parse_ids("genre_ids")
        tag_ids = parse_ids("tag_ids")
        fandom_ids = parse_ids("fandom_ids")
        gids, tids, fids = services.normalize_search_filter_ids(
            genre_ids, tag_ids, fandom_ids
        )
        ranked = services.rank_search_ads(Advertisement, gids, tids, fids)
        serializer = self.get_serializer(ranked, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def user_advertisements(self, request):
        logger.info(f"Отримання реклами для користувача: {request.user.id}")
        try:
            ads = self.queryset.filter(user=request.user).order_by("-created_at")
            serializer = self.get_serializer(ads, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Помилка в user_advertisements: {str(e)}", exc_info=True)
            raise
