import logging

import stripe
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.throttling import ScopedRateThrottle

from apps.payments.models import PaymentSession
from apps.payments.services import (
    create_checkout_session,
    handle_checkout_session_completed,
    handle_checkout_session_expired,
)

from .serializers import CreateCheckoutSessionSerializer, SessionStatusQuerySerializer

logger = logging.getLogger(__name__)


class CreateCheckoutSessionView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "purchase"

    def post(self, request):
        if not getattr(settings, "STRIPE_SECRET_KEY", None):
            return Response({"error": "Stripe is not configured"}, status=500)

        serializer = CreateCheckoutSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]

        try:
            result = create_checkout_session(
                user=request.user,
                amount_coins=amount,
                request_meta={
                    "ip": request.META.get("REMOTE_ADDR"),
                    "user_agent": request.META.get("HTTP_USER_AGENT"),
                },
            )
        except Exception as e:
            # keep message user-friendly; details in logs
            logger.error("create_checkout_session failed: %s", e, exc_info=True)
            return Response({"error": "Не вдалося створити платіж. Спробуйте ще раз."}, status=400)

        return Response({"checkout_url": result.checkout_url})


class PaymentSessionStatusView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        qs = SessionStatusQuerySerializer(data=request.query_params)
        qs.is_valid(raise_exception=True)
        session_id = qs.validated_data["session_id"]

        try:
            s = PaymentSession.objects.get(stripe_session_id=session_id, user=request.user)
        except PaymentSession.DoesNotExist:
            return Response({"error": "Payment session not found"}, status=404)

        return Response(
            {
                "status": s.status,
                "amount_coins": str(s.amount_coins),
                "paid_at": s.paid_at.isoformat() if s.paid_at else None,
            }
        )


@csrf_exempt
@require_POST
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")

    if not getattr(settings, "STRIPE_WEBHOOK_SECRET", None):
        return HttpResponse(status=500)

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        return HttpResponse(status=400)

    event_type = event.get("type")

    try:
        if event_type == "checkout.session.completed":
            handle_checkout_session_completed(event=event)
        elif event_type == "checkout.session.expired":
            handle_checkout_session_expired(event=event)
        else:
            # ignore other events
            pass
    except Exception as e:
        # Return 200 anyway to avoid Stripe retries for non-actionable failures;
        # we keep details in logs and dedupe prevents double credit.
        logger.error("stripe webhook handler error: %s", e, exc_info=True)

    return JsonResponse({"received": True})

