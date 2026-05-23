import json
import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Exists, OuterRef
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.payouts.api.serializers import (
    CreatePayoutRequestSerializer,
    PayoutMethodSerializer,
    PayoutProfileSerializer,
    PayoutRequestSerializer,
)
from apps.payouts.models import (
    PayoutMethod,
    PayoutProfile,
    PayoutRequest,
    WiseWebhookDelivery,
)
from apps.payouts.services.payout_cancel import cancel_payout_request
from apps.payouts.services.payout_create import create_payout_request
from apps.payouts.services.webhook import process_wise_webhook, verify_wise_signature

logger = logging.getLogger(__name__)


class PayoutProfileView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_throttles(self):
        if self.request.method in ("POST", "PUT", "DELETE"):
            self.throttle_scope = "payout_profile"
            return [ScopedRateThrottle()]
        return []

    def get(self, request):
        try:
            profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response({"exists": False})
        return Response(PayoutProfileSerializer(profile).data)

    def post(self, request):
        try:
            existing = request.user.payout_profile
            # Скасований профіль — дозволяємо перезаписати (нова заявка)
            if existing.verification_status == PayoutProfile.VerificationStatus.CANCELLED:
                serializer = PayoutProfileSerializer(
                    existing, data=request.data, partial=False
                )
                serializer.is_valid(raise_exception=True)
                serializer.save(
                    verification_status=PayoutProfile.VerificationStatus.DRAFT,
                    payout_approved=False,
                )
                return Response(serializer.data, status=201)
            status_labels = {
                "pending": "Ваша заявка на виплати вже подана і очікує перевірки",
                "approved": "Ваш профіль виплат вже схвалено",
                "draft": "У вас вже є чернетка заявки — завершіть її",
                "rejected": "Ваша попередня заявка була відхилена — ви можете відредагувати та подати повторно",
                "requires_more_info": "Потрібна додаткова інформація до вашої заявки — відредагуйте та подайте повторно",
            }
            msg = status_labels.get(existing.verification_status, "Заявка на виплати вже існує")
            return Response({"error": msg}, status=400)
        except PayoutProfile.DoesNotExist:
            pass
        serializer = PayoutProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=201)

    def put(self, request):
        try:
            profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response({"error": "Профіль не знайдено"}, status=404)
        if profile.verification_status in (
            PayoutProfile.VerificationStatus.APPROVED,
            PayoutProfile.VerificationStatus.PENDING,
        ):
            return Response(
                {"error": "Неможливо змінити профіль у поточному статусі"},
                status=400,
            )
        serializer = PayoutProfileSerializer(
            profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        save_kwargs = {}
        if profile.verification_status == PayoutProfile.VerificationStatus.CANCELLED:
            save_kwargs["verification_status"] = PayoutProfile.VerificationStatus.DRAFT
        serializer.save(**save_kwargs)
        return Response(serializer.data)

    @transaction.atomic
    def delete(self, request):
        """Скасувати заявку на виплати (soft delete), якщо вона ще не схвалена."""
        try:
            profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response({"error": "Заявку не знайдено"}, status=404)
        if profile.verification_status in (
            PayoutProfile.VerificationStatus.APPROVED,
            PayoutProfile.VerificationStatus.CANCELLED,
        ):
            return Response(
                {"error": "Цю заявку не можна скасувати"},
                status=400,
            )
        # Перевіряємо, чи немає запитів що вже обробляються (з блокуванням)
        non_cancellable = PayoutRequest.objects.select_for_update().filter(
            profile=profile,
            status__in=[
                PayoutRequest.Status.APPROVED,
                PayoutRequest.Status.IN_BATCH,
                PayoutRequest.Status.PROCESSING,
            ],
        ).exists()
        if non_cancellable:
            return Response(
                {"error": "Неможливо скасувати — виплата вже обробляється"},
                status=400,
            )
        # Скасувати пов'язані запити на виплату і повернути кошти
        cancellable = PayoutRequest.objects.select_for_update().filter(
            profile=profile,
            status__in=[
                PayoutRequest.Status.PENDING,
                PayoutRequest.Status.AWAITING_REVIEW,
            ],
        )
        for req in cancellable:
            cancel_payout_request(req, "Скасовано разом із заявкою")
        # Soft delete: деактивуємо методи, ставимо статус CANCELLED
        profile.methods.filter(is_active=True).update(is_active=False)
        profile.verification_status = PayoutProfile.VerificationStatus.CANCELLED
        profile.save(update_fields=["verification_status"])
        return Response({"status": "cancelled"})


class PayoutProfileSubmitView(APIView):
    """Подати профіль виплат на перевірку разом із запитом на виплату."""

    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payout_submit"

    MAX_PENDING_REQUESTS = 3

    @transaction.atomic
    def post(self, request):
        from decimal import Decimal

        try:
            profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response({"error": "Профіль не знайдено"}, status=404)

        if profile.verification_status not in (
            PayoutProfile.VerificationStatus.DRAFT,
            PayoutProfile.VerificationStatus.REQUIRES_MORE_INFO,
            PayoutProfile.VerificationStatus.REJECTED,
            PayoutProfile.VerificationStatus.CANCELLED,
        ):
            return Response(
                {"error": "Профіль уже подано або схвалено"},
                status=400,
            )

        if not profile.methods.filter(is_active=True).exists():
            return Response(
                {"error": "Додайте хоча б один активний метод виплати"},
                status=400,
            )

        pending_count = PayoutRequest.objects.filter(
            profile=profile,
            status__in=[
                PayoutRequest.Status.PENDING,
                PayoutRequest.Status.AWAITING_REVIEW,
            ],
        ).count()
        if pending_count >= self.MAX_PENDING_REQUESTS:
            return Response(
                {"error": "Занадто багато необроблених запитів. Дочекайтесь перевірки."},
                status=400,
            )

        # --- Сума виплати ---
        try:
            coins_amount = Decimal(str(request.data.get("coins_amount", 0)))
        except Exception:
            return Response({"error": "Невірна сума"}, status=400)

        if coins_amount <= 0:
            return Response({"error": "Сума повинна бути більше нуля"}, status=400)

        max_amount = settings.PAYOUTS_MAX_AMOUNT_COINS
        if coins_amount > max_amount:
            return Response(
                {"error": f"Максимальна сума виведення: {max_amount} FanCoins"},
                status=400,
            )

        min_amount = settings.PAYOUTS_MIN_AMOUNT_COINS
        if coins_amount < min_amount:
            return Response(
                {"error": f"Мінімальна сума виведення: {min_amount} FanCoins"},
                status=400,
            )

        method = profile.methods.filter(is_active=True, is_default=True).first()
        if not method:
            method = profile.methods.filter(is_active=True).first()

        idempotency_key = request.data.get("idempotency_key", "")
        if not idempotency_key:
            return Response({"error": "idempotency_key є обов'язковим"}, status=400)

        is_urgent = bool(request.data.get("is_urgent", False))

        try:
            create_payout_request(
                user=request.user,
                coins_amount=coins_amount,
                method=method,
                idempotency_key=idempotency_key,
                skip_profile_approval_check=True,
                is_urgent=is_urgent,
            )
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)

        # Оновлення статусу профілю
        profile.verification_status = PayoutProfile.VerificationStatus.PENDING
        profile.submitted_at = timezone.now()
        profile.save(update_fields=["verification_status", "submitted_at"])

        return Response(PayoutProfileSerializer(profile).data)


class PayoutMethodView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "payout_method"
            return [ScopedRateThrottle()]
        return []

    def get(self, request):
        try:
            methods = PayoutMethod.objects.filter(
                profile=request.user.payout_profile,
                is_active=True,
            ).annotate(
                used_in_payouts=Exists(
                    PayoutRequest.objects.filter(
                        method_id=OuterRef("pk"),
                        status__in=[
                            PayoutRequest.Status.APPROVED,
                            PayoutRequest.Status.IN_BATCH,
                            PayoutRequest.Status.PROCESSING,
                            PayoutRequest.Status.COMPLETED,
                            PayoutRequest.Status.FAILED,
                        ],
                    )
                )
            )
        except PayoutProfile.DoesNotExist:
            return Response([])
        return Response(PayoutMethodSerializer(methods, many=True).data)

    MAX_ACTIVE_METHODS = 5

    def post(self, request):
        try:
            payout_profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response(
                {"error": "Спочатку створіть профіль виплат"},
                status=400,
            )
        active_count = PayoutMethod.objects.filter(
            profile=payout_profile, is_active=True,
        ).count()
        if active_count >= self.MAX_ACTIVE_METHODS:
            return Response(
                {"error": f"Максимум {self.MAX_ACTIVE_METHODS} активних методів виплати"},
                status=400,
            )
        serializer = PayoutMethodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(profile=payout_profile)
        return Response(serializer.data, status=201)


class PayoutMethodDetailView(APIView):
    """Один метод виплати з повним IBAN (для форми виведення)."""

    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, pk):
        try:
            payout_profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response({"error": "Профіль виплат не знайдено"}, status=404)
        try:
            method = PayoutMethod.objects.get(
                pk=pk,
                profile=payout_profile,
                is_active=True,
            )
        except PayoutMethod.DoesNotExist:
            return Response({"error": "Метод виплати не знайдено"}, status=404)
        return Response(PayoutMethodSerializer(method).data)


class CreatePayoutRequestView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payout"

    def post(self, request):
        serializer = CreatePayoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payout_profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response(
                {"error": "Профіль виплат не налаштовано"},
                status=400,
            )
        try:
            method = PayoutMethod.objects.get(
                id=serializer.validated_data["method_id"],
                profile=payout_profile,
                is_active=True,
            )
        except PayoutMethod.DoesNotExist:
            return Response({"error": "Метод виплати не знайдено"}, status=400)
        try:
            payout_request = create_payout_request(
                user=request.user,
                coins_amount=serializer.validated_data["amount"],
                method=method,
                idempotency_key=serializer.validated_data["idempotency_key"],
                is_urgent=serializer.validated_data.get("is_urgent", False),
            )
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)
        request.user.profile.refresh_from_db(fields=["balance"])
        data = PayoutRequestSerializer(payout_request).data
        data["new_balance"] = str(request.user.profile.balance)
        return Response(data, status=201)


class PayoutRequestListView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        try:
            payout_profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response([])
        requests_qs = PayoutRequest.objects.filter(profile=payout_profile).order_by(
            "-created_at"
        )[:50]
        return Response(PayoutRequestSerializer(requests_qs, many=True).data)


class CancelPayoutRequestView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payout_cancel"

    @transaction.atomic
    def post(self, request, pk):
        try:
            payout_request = PayoutRequest.objects.select_for_update().get(
                id=pk,
                profile=request.user.payout_profile,
            )
        except (PayoutRequest.DoesNotExist, PayoutProfile.DoesNotExist):
            return Response({"error": "Запит не знайдено"}, status=404)
        if payout_request.status not in (
            PayoutRequest.Status.PENDING,
            PayoutRequest.Status.AWAITING_REVIEW,
        ):
            return Response(
                {"error": "Запит у цьому статусі не можна скасувати"},
                status=400,
            )
        try:
            cancel_payout_request(payout_request, "Скасовано користувачем")
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)
        request.user.profile.refresh_from_db(fields=["balance"])
        return Response(
            {
                "status": "cancelled",
                "new_balance": str(request.user.profile.balance),
            }
        )


@csrf_exempt
@require_POST
def wise_webhook_view(request):
    if not verify_wise_signature(request):
        return HttpResponse(status=403)
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return HttpResponse(status=400)

    delivery_id = request.headers.get("X-Delivery-Id", "")
    if not delivery_id:
        return HttpResponse(status=400)

    try:
        WiseWebhookDelivery.objects.create(delivery_id=delivery_id)
    except IntegrityError:
        return JsonResponse({"received": True})

    process_wise_webhook(data)
    return JsonResponse({"received": True})
