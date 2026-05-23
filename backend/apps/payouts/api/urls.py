from django.urls import path

from .views import (
    CancelPayoutRequestView,
    CreatePayoutRequestView,
    PayoutMethodDetailView,
    PayoutMethodView,
    PayoutProfileSubmitView,
    PayoutProfileView,
    PayoutRequestListView,
    wise_webhook_view,
)

app_name = "payouts"

urlpatterns = [
    path("profile/", PayoutProfileView.as_view(), name="payout_profile"),
    path(
        "profile/submit/",
        PayoutProfileSubmitView.as_view(),
        name="payout_profile_submit",
    ),
    path("methods/", PayoutMethodView.as_view(), name="payout_methods"),
    path(
        "methods/<int:pk>/",
        PayoutMethodDetailView.as_view(),
        name="payout_method_detail",
    ),
    path("request/", CreatePayoutRequestView.as_view(), name="create_payout_request"),
    path("requests/", PayoutRequestListView.as_view(), name="payout_requests_list"),
    path(
        "request/<int:pk>/cancel/",
        CancelPayoutRequestView.as_view(),
        name="cancel_payout_request",
    ),
    path("webhook/wise/", wise_webhook_view, name="wise_webhook"),
]
