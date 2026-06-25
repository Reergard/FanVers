from django.db.models.signals import pre_delete
from django.dispatch import receiver

from apps.catalog.models import BookImage


@receiver(pre_delete, sender=BookImage)
def delete_book_image_file(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)
