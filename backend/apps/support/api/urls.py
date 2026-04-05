from django.urls import path

from .views import SupportTicketCreateView

app_name = "support"

urlpatterns = [
    path("tickets/", SupportTicketCreateView.as_view(), name="ticket-create"),
]
