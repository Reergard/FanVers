from django.core.management.base import BaseCommand
from apps.catalog.models import Chapter
from decimal import Decimal


class Command(BaseCommand):
    help = 'Исправляет цену для бесплатных глав (устанавливает price=0 для is_paid=False)'

    def handle(self, *args, **options):
        # Находим все главы с is_paid=False но price != 0
        free_chapters = Chapter.objects.filter(
            is_paid=False,
            price__gt=0
        )
        
        count = free_chapters.count()
        self.stdout.write(f'Найдено {count} бесплатных глав с неправильной ценой')
        
        if count > 0:
            # Обновляем цену на 0 для всех бесплатных глав
            updated = free_chapters.update(price=Decimal('0.00'))
            self.stdout.write(
                self.style.SUCCESS(f'Успешно обновлено {updated} глав')
            )
        else:
            self.stdout.write('Нет глав для обновления')
