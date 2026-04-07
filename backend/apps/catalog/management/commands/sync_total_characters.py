"""
Команда для синхронізації Profile.total_characters та commission з фактичних даних глав.

Запускати коли:
  - підозра на розбіжність (наприклад, після ручних змін у БД);
  - після масових міграцій даних;
  - після імпорту глав з обходом сигналів.

Приклади:
  python manage.py sync_total_characters
  python manage.py sync_total_characters --user-id 42
  python manage.py sync_total_characters --dry-run
  python manage.py sync_total_characters --dry-run --user-id 42
"""
import logging
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum

from apps.users.models import Profile

logger = logging.getLogger(__name__)


def _commission_for(total_chars: int) -> Decimal:
    if total_chars >= 10_000_000:
        return Decimal('10.00')
    if total_chars >= 5_000_000:
        return Decimal('12.00')
    return Decimal('15.00')


class Command(BaseCommand):
    help = (
        'Перераховує Profile.total_characters із актуальних characters_count глав '
        'та оновлює commission. Використовуйте для відновлення консистентності даних.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            default=None,
            metavar='USER_ID',
            help='Оновити лише профіль із вказаним user_id (за замовчуванням — всі профілі).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Показати що буде змінено без запису в БД.',
        )

    def handle(self, *args, **options):
        from apps.catalog.models import Chapter  # уникаємо circular import на рівні модуля

        user_id = options['user_id']
        dry_run = options['dry_run']

        qs = Profile.objects.select_related('user').all()
        if user_id is not None:
            qs = qs.filter(user_id=user_id)
            if not qs.exists():
                self.stderr.write(
                    self.style.ERROR(f'Профіль із user_id={user_id} не знайдено.')
                )
                return

        total_profiles = qs.count()
        mode_label = '[DRY-RUN] ' if dry_run else ''
        self.stdout.write(
            f'{mode_label}Обробляємо {total_profiles} профіл(ів)...'
        )

        needs_update = 0
        actually_updated = 0

        for profile in qs.iterator(chunk_size=200):
            # Агрегуємо фактичні символи
            real_total = (
                Chapter.objects
                .filter(book__owner=profile.user)
                .aggregate(total=Sum('characters_count'))['total']
            ) or 0

            correct_commission = _commission_for(real_total)

            chars_changed = profile.total_characters != real_total
            comm_changed = profile.commission != correct_commission

            if not chars_changed and not comm_changed:
                continue

            needs_update += 1

            if dry_run:
                msgs = []
                if chars_changed:
                    msgs.append(
                        f'total_characters: {profile.total_characters} → {real_total}'
                    )
                if comm_changed:
                    msgs.append(
                        f'commission: {profile.commission}% → {correct_commission}%'
                    )
                self.stdout.write(
                    f'  [DRY-RUN] {profile.user.username} (user_id={profile.user_id}): '
                    + ', '.join(msgs)
                )
            else:
                try:
                    Profile.objects.filter(pk=profile.pk).update(
                        total_characters=real_total,
                        commission=correct_commission,
                    )
                    actually_updated += 1
                    if chars_changed or comm_changed:
                        msgs = []
                        if chars_changed:
                            msgs.append(
                                f'total_characters {profile.total_characters}→{real_total}'
                            )
                        if comm_changed:
                            msgs.append(
                                f'commission {profile.commission}%→{correct_commission}%'
                            )
                        self.stdout.write(
                            f'  ✓ {profile.user.username}: ' + ', '.join(msgs)
                        )
                except Exception as exc:
                    logger.error(
                        'sync_total_characters: помилка для profile pk=%s: %s',
                        profile.pk,
                        exc,
                        exc_info=True,
                    )
                    self.stderr.write(
                        self.style.ERROR(
                            f'  Помилка для {profile.user.username}: {exc}'
                        )
                    )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\n[DRY-RUN] Потребують оновлення: {needs_update} з {total_profiles} профіл(ів). '
                    f'Запустіть без --dry-run щоб застосувати.'
                )
            )
        else:
            if actually_updated:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\nУспішно синхронізовано: {actually_updated} з {total_profiles} профіл(ів).'
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'\nВсі {total_profiles} профіл(ів) вже консистентні. Нічого не змінено.'
                    )
                )
