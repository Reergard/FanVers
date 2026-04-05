from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from .models import SupportTicket, SupportTicketStatusHistory


@receiver(pre_save, sender=SupportTicket, dispatch_uid="support_ticket_pre_save_cache_status")
def support_ticket_cache_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return
    try:
        old = SupportTicket.objects.get(pk=instance.pk)
        instance._previous_status = old.status
    except SupportTicket.DoesNotExist:
        instance._previous_status = None


@receiver(
    post_save,
    sender=SupportTicket,
    dispatch_uid="support_ticket_post_save_ordered",
)
def support_ticket_post_save(sender, instance, created, **kwargs):
    """
    Один обробник: детермінований порядок — спочатку номер тикета, потім історія статусу.
    """
    if created and not instance.ticket_number:
        tn = f"FV-{timezone.now().year}-{instance.pk:06d}"
        SupportTicket.objects.filter(pk=instance.pk).update(ticket_number=tn)
        instance.ticket_number = tn

    if created:
        SupportTicketStatusHistory.objects.create(
            ticket=instance,
            old_status="",
            new_status=instance.status,
            changed_by=None,
        )
        return

    prev = getattr(instance, "_previous_status", None)
    if prev is not None and prev != instance.status:
        SupportTicketStatusHistory.objects.create(
            ticket=instance,
            old_status=prev,
            new_status=instance.status,
            changed_by=getattr(instance, "_status_changed_by", None),
        )
