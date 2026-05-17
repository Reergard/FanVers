import json

from django.core.exceptions import ValidationError
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
from apps.payouts.models import PayoutMethod, PayoutProfile, PayoutRequest
from apps.payouts.services.payout_cancel import cancel_payout_request
from apps.payouts.services.payout_create import create_payout_request
from apps.payouts.services.webhook import process_wise_webhook, verify_wise_signature


class PayoutProfileView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        try:
            profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response({"exists": False})
        return Response(PayoutProfileSerializer(profile).data)

    def post(self, request):
        try:
            request.user.payout_profile
            return Response({"error": "Профіль вже існує"}, status=400)
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
        serializer = PayoutProfileSerializer(
            profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PayoutProfileSubmitView(APIView):
    """Подати профіль виплат на перевірку."""

    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        try:
            profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response({"error": "Профіль не знайдено"}, status=404)

        if profile.verification_status not in (
            PayoutProfile.VerificationStatus.DRAFT,
            PayoutProfile.VerificationStatus.REQUIRES_MORE_INFO,
            PayoutProfile.VerificationStatus.REJECTED,
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

        profile.verification_status = PayoutProfile.VerificationStatus.PENDING
        profile.submitted_at = timezone.now()
        profile.save(update_fields=["verification_status", "submitted_at"])
        return Response(PayoutProfileSerializer(profile).data)


class PayoutMethodView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        try:
            methods = PayoutMethod.objects.filter(
                profile=request.user.payout_profile,
                is_active=True,
            )
        except PayoutProfile.DoesNotExist:
            return Response([])
        return Response(PayoutMethodSerializer(methods, many=True).data)

    def post(self, request):
        try:
            payout_profile = request.user.payout_profile
        except PayoutProfile.DoesNotExist:
            return Response(
                {"error": "Спочатку створіть профіль виплат"},
                status=400,
            )
        serializer = PayoutMethodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(profile=payout_profile)
        return Response(serializer.data, status=201)


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
            )
        except ValidationError as e:
            return Response({"error": str(e)}, status=400)
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

    def post(self, request, pk):
        try:
            payout_request = PayoutRequest.objects.get(
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
    data = json.loads(request.body)
    process_wise_webhook(data)
    return JsonResponse({"received": True})
