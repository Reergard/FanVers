from django.urls import path
from .views import (
    SubscriptionSettingsView,
    purchase_plan,
    apply_plan,
    UserSubscriptionsView,
    admin_restore_slot,
    admin_refund_fancoins,
    admin_close_pack,
)

app_name = 'subscription'

urlpatterns = [
    path('books/<slug:book_slug>/', SubscriptionSettingsView.as_view(), name='settings'),
    path('books/<slug:book_slug>/purchase-plan/', purchase_plan, name='purchase_plan'),
    path('books/<slug:book_slug>/apply-plan/', apply_plan, name='apply_plan'),
    path('user/subscriptions/', UserSubscriptionsView.as_view(), name='user_subscriptions'),
    path('admin/subscriptions/<int:subscription_id>/restore-slot/', admin_restore_slot, name='admin_restore_slot'),
    path('admin/subscriptions/<int:subscription_id>/refund-fancoins/', admin_refund_fancoins, name='admin_refund_fancoins'),
    path('admin/subscriptions/<int:subscription_id>/close-pack/', admin_close_pack, name='admin_close_pack'),
]
