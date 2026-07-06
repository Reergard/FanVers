from django.urls import path

from .views import CreateCheckoutSessionView, FeePreviewView, PaymentSessionStatusView, stripe_webhook


app_name = "payments"

urlpatterns = [
    path("fee-preview/", FeePreviewView.as_view(), name="fee_preview"),
    path("create-checkout-session/", CreateCheckoutSessionView.as_view(), name="create_checkout_session"),
    path("webhook/", stripe_webhook, name="stripe_webhook"),
    path("session-status/", PaymentSessionStatusView.as_view(), name="session_status"),
]

