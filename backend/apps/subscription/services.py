"""
Subscription service layer.

Єдиний сервісний шар для всіх операцій підписки.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.db.utils import IntegrityError
from django.utils import timezone

from .models import (
    BookSubscriptionSettings,
    BookSubscriptionPlan,
    UserBookSubscription,
    UserBookSubscriptionUsage,
    UserChapterAccess,
    SubscriptionOperation,
    SubscriptionAdminAuditLog,
)
from apps.catalog.models import Book, Chapter
from apps.catalog.api.permissions import check_book_access_permission
from apps.users.models import Profile
from apps.monitoring.models import TransactionLog

logger = logging.getLogger(__name__)

# Error codes for API
INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE'
PLAN_NOT_ACTIVE = 'PLAN_NOT_ACTIVE'
PLAN_CHAPTER_COUNT_MISMATCH = 'PLAN_CHAPTER_COUNT_MISMATCH'
CHAPTER_ALREADY_PURCHASED = 'CHAPTER_ALREADY_PURCHASED'
ACTIVE_SUBSCRIPTION_ALREADY_EXISTS = 'ACTIVE_SUBSCRIPTION_ALREADY_EXISTS'
INVALID_CHAPTER_SELECTION = 'INVALID_CHAPTER_SELECTION'
SUBSCRIPTION_EXHAUSTED = 'SUBSCRIPTION_EXHAUSTED'
BOOK_NOT_FOUND = 'BOOK_NOT_FOUND'
CHAPTER_NOT_FOUND = 'CHAPTER_NOT_FOUND'
ACCESS_DENIED = 'ACCESS_DENIED'
INDIVIDUAL_PURCHASE_DISABLED = 'INDIVIDUAL_PURCHASE_DISABLED'
MULTIPLE_ACTIVE_PREPAID = 'MULTIPLE_ACTIVE_PREPAID'


def user_has_chapter_access(user, chapter_id):
    """Перевірка доступу до глави через UserChapterAccess."""
    if not user or not user.is_authenticated:
        return False
    return UserChapterAccess.objects.filter(
        user=user,
        chapter_id=chapter_id,
    ).exists()


def get_user_chapter_access_ids(user, chapter_ids):
    """
    Повернути set chapter_id, до яких у користувача є доступ.
    Один batch-запит замість N exists().
    """
    if not user or not user.is_authenticated:
        return set()
    chapter_ids = list({int(ch_id) for ch_id in chapter_ids if ch_id is not None})
    if not chapter_ids:
        return set()
    return set(
        UserChapterAccess.objects.filter(
            user=user,
            chapter_id__in=chapter_ids,
        ).values_list('chapter_id', flat=True)
    )


def _validate_book_chapter_access(user, book, chapter):
    """Перевірка доступу до книги та глави."""
    if not book or book.pk != chapter.book_id:
        return False, BOOK_NOT_FOUND
    is_allowed, _ = check_book_access_permission(user, book, 'download')
    if not is_allowed:
        return False, ACCESS_DENIED
    return True, None


def _get_chapter_price_for_purchase(chapter, settings=None):
    """
    Ціна глави при індивідуальній покупці.
    Завжди використовуємо chapter.price (ціна вказується при створенні глави).
    """
    return chapter.price


def _calculate_plan_price(plan, book, chapter_ids=None):
    """
    Розрахунок ціни для плану: сума цін глав * (1 - discount_percent/100) при count >= threshold.
    - Для instant: chapter_ids — обрані глави.
    - Для prepaid: беремо перші N платних глав книги (N = discount_threshold).
    """
    threshold = plan.discount_threshold or 1
    discount = (plan.discount_percent or Decimal('0')) / Decimal('100')

    if chapter_ids is not None:
        chapters = list(
            Chapter.objects.filter(
                id__in=chapter_ids,
                book=book,
                is_paid=True,
                price__gt=0
            ).order_by('order')
        )
        if len(chapters) < threshold:
            return None
    else:
        chapters = list(
            Chapter.objects.filter(
                book=book,
                is_paid=True,
                price__gt=0
            ).order_by('order')[:threshold]
        )
        if len(chapters) < threshold:
            return None

    total = sum(ch.price for ch in chapters)
    if discount > 0:
        total = total * (Decimal('1') - discount)
    return total.quantize(Decimal('0.01'))


class SubscriptionSettingsService:
    """Сервіс оновлення налаштувань підписки."""

    MAX_ACTIVE_PLANS = 2

    @classmethod
    def update_settings(cls, instance, validated_data):
        plans_data = validated_data.pop('plans', None)
        settings_fields = {f: validated_data[f] for f in ('is_enabled',) if f in validated_data}

        with transaction.atomic():
            instance = BookSubscriptionSettings.objects.select_for_update().get(pk=instance.pk)
            for field, value in settings_fields.items():
                setattr(instance, field, value)
            instance.save()

            if plans_data is not None:
                list(instance.plans.select_for_update().all())
                updated_ids = {p.get('id') for p in plans_data if p.get('id')}
                # Спочатку деактивуємо omitted — щоб full_clean() не бачив «зайвих» активних
                instance.plans.exclude(pk__in=updated_ids).update(is_active=False)

                for i, plan_data in enumerate(plans_data):
                    plan_id = plan_data.get('id')
                    discount_percent = plan_data.get('discount_percent')
                    discount_threshold = plan_data.get('discount_threshold')
                    purchase_mode = plan_data.get('purchase_mode', 'prepaid')
                    if discount_percent is None or discount_threshold is None:
                        continue
                    discount_percent = Decimal(str(discount_percent))
                    discount_threshold = int(discount_threshold)
                    if purchase_mode not in (BookSubscriptionPlan.PURCHASE_MODE_PREPAID, BookSubscriptionPlan.PURCHASE_MODE_INSTANT):
                        purchase_mode = BookSubscriptionPlan.PURCHASE_MODE_PREPAID
                    is_active = plan_data.get('is_active', True)
                    sort_order = plan_data.get('sort_order', i)
                    if plan_id and instance.plans.filter(pk=plan_id).exists():
                        plan = instance.plans.get(pk=plan_id)
                        plan.discount_percent = discount_percent
                        plan.discount_threshold = discount_threshold
                        plan.chapters_count = discount_threshold
                        plan.purchase_mode = purchase_mode
                        plan.is_active = is_active
                        plan.sort_order = sort_order
                        plan.full_clean()
                        plan.save()
                    else:
                        plan = BookSubscriptionPlan(
                            settings=instance,
                            discount_percent=discount_percent,
                            discount_threshold=discount_threshold,
                            chapters_count=discount_threshold,
                            price=Decimal('0'),
                            purchase_mode=purchase_mode,
                            is_active=is_active,
                            sort_order=sort_order,
                        )
                        plan.full_clean()
                        plan.save()

                active_after = instance.plans.filter(is_active=True).count()
                if active_after > cls.MAX_ACTIVE_PLANS:
                    from rest_framework import serializers as rf_serializers
                    raise rf_serializers.ValidationError(
                        {'plans': f'Максимум {cls.MAX_ACTIVE_PLANS} активних планів'}
                    )

        return instance


class SubscriptionService:
    """Сервіс підписки."""

    @staticmethod
    def get_active_user_subscription_for_book(user, book):
        """
        Отримати активний prepaid пакет користувача для книги.
        instant_selected НЕ береться до уваги.
        Якщо знайдено більше одного — це помилка, логуємо і піднімаємо виключення.
        """
        if not user or not user.is_authenticated or not book:
            return None
        qs = UserBookSubscription.objects.filter(
            user=user,
            book=book,
            status=UserBookSubscription.STATUS_ACTIVE,
            purchase_mode=UserBookSubscription.PURCHASE_MODE_PREPAID,
            remaining_chapters_count__gt=0,
        )
        subs = list(qs[:2])
        if len(subs) > 1:
            logger.error(
                'MULTIPLE_ACTIVE_PREPAID: user=%s book=%s count=%d ids=%s',
                user.id, book.id, len(subs), [s.id for s in subs]
            )
            raise ValueError(MULTIPLE_ACTIVE_PREPAID)
        return subs[0] if subs else None

    @staticmethod
    def purchase_plan_for_future(user, book, plan_id, idempotency_key, request_id=None):
        """
        Купити пакет "в запас" (prepaid).
        idempotency_key обов'язковий — без нього ідемпотентність неможлива.
        Returns: (success, data_or_error_code, detail)
        """
        op_type = 'purchase_plan_prepaid'
        payload = {'plan_id': plan_id, 'book_id': book.id}
        with transaction.atomic():
            op, created = SubscriptionOperation.objects.select_for_update().get_or_create(
                user=user,
                operation_type=op_type,
                idempotency_key=idempotency_key,
                defaults={'status': SubscriptionOperation.STATUS_PENDING, 'payload_snapshot': payload}
            )
            if not created and op.status == SubscriptionOperation.STATUS_COMPLETED:
                return True, op.result_snapshot, 'already_completed'
            if not created and op.status == SubscriptionOperation.STATUS_FAILED:
                return False, op.error_code, op.result_snapshot

            try:
                plan = BookSubscriptionPlan.objects.select_related('settings__book').get(
                    pk=plan_id,
                    is_active=True,
                    settings__book=book,
                    purchase_mode=BookSubscriptionPlan.PURCHASE_MODE_PREPAID,
                )
            except BookSubscriptionPlan.DoesNotExist:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = PLAN_NOT_ACTIVE
                op.save()
                return False, PLAN_NOT_ACTIVE, 'Plan not found or inactive'

            book = plan.settings.book

            is_allowed, err = check_book_access_permission(user, book, 'view')
            if not is_allowed:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = ACCESS_DENIED
                op.save()
                return False, ACCESS_DENIED, err

            if book.owner_id == user.id:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = ACCESS_DENIED
                op.save()
                return False, ACCESS_DENIED, 'Cannot buy own book subscription'

            # Check active prepaid already exists (inside transaction, before create)
            existing = SubscriptionService.get_active_user_subscription_for_book(user, book)
            if existing:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = ACTIVE_SUBSCRIPTION_ALREADY_EXISTS
                op.save()
                return False, ACTIVE_SUBSCRIPTION_ALREADY_EXISTS, 'Active subscription exists'

            charge_price = _calculate_plan_price(plan, book)
            if charge_price is None or charge_price <= 0:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = INVALID_CHAPTER_SELECTION
                op.save()
                return False, INVALID_CHAPTER_SELECTION, 'Not enough paid chapters for this plan'

            profile = user.profile
            Profile.objects.select_for_update().get(pk=profile.pk)
            if profile.balance < charge_price:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = INSUFFICIENT_BALANCE
                op.save()
                return False, INSUFFICIENT_BALANCE, 'Insufficient balance'

            # Важливо: спочатку списуємо баланс, потім створюємо підписку.
            # Усе в одному savepoint/atomic, щоб при помилці не лишалось "безкоштовної" підписки.
            sid = transaction.savepoint()
            try:
                owner_profile = book.owner.profile
                commission = owner_profile.calculate_commission_amount(charge_price)
                owner_amount = charge_price - commission

                balance_before = float(profile.balance)
                profile.balance_operation(charge_price, 'purchase')
                owner_profile.balance_operation(owner_amount, 'earning')
                profile.refresh_from_db()
                balance_after = float(profile.balance)

                sub = UserBookSubscription.objects.create(
                    user=user,
                    book=book,
                    plan=plan,
                    purchased_chapters_count=plan.discount_threshold,
                    remaining_chapters_count=plan.discount_threshold,
                    price_paid=charge_price,
                    status=UserBookSubscription.STATUS_ACTIVE,
                    purchase_mode=UserBookSubscription.PURCHASE_MODE_PREPAID,
                )
            except IntegrityError:
                transaction.savepoint_rollback(sid)
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = ACTIVE_SUBSCRIPTION_ALREADY_EXISTS
                op.result_snapshot = 'Race: another prepaid created concurrently'
                op.save()
                return False, ACTIVE_SUBSCRIPTION_ALREADY_EXISTS, 'Active subscription exists (race)'
            transaction.savepoint_commit(sid)

            audit = {
                'plan_id': plan.id,
                'balance_before': balance_before,
                'balance_after': balance_after,
                'subscription_before': None,
                'subscription_after': 'created',
            }
            if request_id:
                audit['request_id'] = request_id
            TransactionLog.objects.create(
                buyer=profile,
                owner=owner_profile,
                chapter=None,
                book=book,
                original_price=charge_price,
                commission_percent=owner_profile.commission,
                commission_amount=commission,
                final_amount=owner_amount,
                audit_metadata=audit
            )

            op.status = SubscriptionOperation.STATUS_COMPLETED
            op.result_snapshot = {
                'subscription_id': sub.id,
                'remaining_chapters_count': sub.remaining_chapters_count,
                'price_paid': float(charge_price),
            }
            op.save()

            return True, op.result_snapshot, None

    @staticmethod
    def apply_plan_to_selected_chapters(user, book_id, plan_id, chapter_ids, idempotency_key, request_id=None):
        """
        Instant bulk purchase: застосувати план до обраних глав.
        chapter_ids має відповідати chapters_count плану.
        idempotency_key обов'язковий.
        """
        op_type = 'apply_plan_instant'
        chapter_ids = sorted(set(chapter_ids))

        payload = {'plan_id': plan_id, 'book_id': book_id, 'chapter_ids': chapter_ids}
        with transaction.atomic():
            op, created = SubscriptionOperation.objects.select_for_update().get_or_create(
                user=user,
                operation_type=op_type,
                idempotency_key=idempotency_key,
                defaults={'status': SubscriptionOperation.STATUS_PENDING, 'payload_snapshot': payload}
            )
            if not created and op.status == SubscriptionOperation.STATUS_COMPLETED:
                return True, op.result_snapshot, 'already_completed'
            if not created and op.status == SubscriptionOperation.STATUS_FAILED:
                return False, op.error_code, op.result_snapshot

            try:
                plan = BookSubscriptionPlan.objects.select_related('settings__book').get(
                    pk=plan_id,
                    is_active=True,
                    purchase_mode=BookSubscriptionPlan.PURCHASE_MODE_INSTANT,
                )
            except BookSubscriptionPlan.DoesNotExist:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = PLAN_NOT_ACTIVE
                op.save()
                return False, PLAN_NOT_ACTIVE, 'Plan not found'

            book = plan.settings.book
            if book.pk != book_id:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = INVALID_CHAPTER_SELECTION
                op.save()
                return False, INVALID_CHAPTER_SELECTION, 'Plan book mismatch'

            is_allowed, err = check_book_access_permission(user, book, 'download')
            if not is_allowed:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = ACCESS_DENIED
                op.save()
                return False, ACCESS_DENIED, err or 'Access denied'

            threshold = plan.discount_threshold or 1
            if len(chapter_ids) < threshold:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = PLAN_CHAPTER_COUNT_MISMATCH
                op.save()
                return False, PLAN_CHAPTER_COUNT_MISMATCH, f'Select at least {threshold} chapters'

            profile = user.profile
            chapters = list(Chapter.objects.filter(
                id__in=chapter_ids,
                book_id=book_id,
                is_paid=True,
                price__gt=0
            ).select_for_update().order_by('id'))
            if len(chapters) < threshold:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = INVALID_CHAPTER_SELECTION
                op.save()
                return False, INVALID_CHAPTER_SELECTION, 'Invalid or free chapters'

            profile = Profile.objects.select_for_update().get(pk=profile.pk)
            existing_access_ids = set(
                UserChapterAccess.objects.filter(
                    user=user,
                    chapter_id__in=chapter_ids,
                ).values_list('chapter_id', flat=True)
            )
            if existing_access_ids:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = CHAPTER_ALREADY_PURCHASED
                op.save()
                return False, CHAPTER_ALREADY_PURCHASED, (
                    f'Chapters already purchased: {sorted(existing_access_ids)}'
                )

            charge_price = _calculate_plan_price(plan, book, chapter_ids)
            if charge_price is None or charge_price <= 0:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = INVALID_CHAPTER_SELECTION
                op.save()
                return False, INVALID_CHAPTER_SELECTION, 'Could not calculate price'

            if profile.balance < charge_price:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = INSUFFICIENT_BALANCE
                op.save()
                return False, INSUFFICIENT_BALANCE, 'Insufficient balance'

            if book.owner_id == user.id:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = ACCESS_DENIED
                op.save()
                return False, ACCESS_DENIED, 'Cannot buy own book'

            sub = UserBookSubscription.objects.create(
                user=user,
                book=book,
                plan=plan,
                purchased_chapters_count=len(chapters),
                remaining_chapters_count=0,
                price_paid=charge_price,
                status=UserBookSubscription.STATUS_EXHAUSTED,
                purchase_mode=UserBookSubscription.PURCHASE_MODE_INSTANT_SELECTED,
            )

            sid = transaction.savepoint()
            try:
                UserChapterAccess.objects.bulk_create([
                    UserChapterAccess(
                        user=user,
                        chapter=ch,
                        book=book,
                        source=UserChapterAccess.SOURCE_BULK,
                        subscription=sub,
                    )
                    for ch in chapters
                ])
            except IntegrityError:
                transaction.savepoint_rollback(sid)
                sub.delete()
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = CHAPTER_ALREADY_PURCHASED
                op.result_snapshot = 'Race: chapter access already exists'
                op.save()
                return False, CHAPTER_ALREADY_PURCHASED, 'Chapter already purchased (race)'
            transaction.savepoint_commit(sid)

            owner_profile = book.owner.profile
            commission = owner_profile.calculate_commission_amount(charge_price)
            owner_amount = charge_price - commission

            balance_before = float(profile.balance)
            profile.balance_operation(charge_price, 'purchase')
            owner_profile.balance_operation(owner_amount, 'earning')
            profile.refresh_from_db()
            balance_after = float(profile.balance)

            audit = {
                'plan_id': plan.id,
                'balance_before': balance_before,
                'balance_after': balance_after,
                'subscription_before': None,
                'subscription_after': 'created_instant',
            }
            if request_id:
                audit['request_id'] = request_id
            TransactionLog.objects.create(
                buyer=profile,
                owner=owner_profile,
                chapter=None,
                book=book,
                original_price=charge_price,
                commission_percent=owner_profile.commission,
                commission_amount=commission,
                final_amount=owner_amount,
                audit_metadata=audit
            )

            for ch in chapters:
                UserBookSubscriptionUsage.objects.create(
                    subscription=sub,
                    chapter=ch,
                    usage_type=UserBookSubscriptionUsage.USAGE_TYPE_BULK_APPLY,
                    source=UserBookSubscriptionUsage.SOURCE_BULK_APPLY_REQUEST,
                    chapters_consumed=1,
                    remaining_after=0,
                )

            def _update_progresses():
                from apps.monitoring.models import UserChapterProgress
                for ch in chapters:
                    UserChapterProgress.objects.update_or_create(
                        user=user,
                        chapter=ch,
                        defaults={'is_purchased': True}
                    )

            transaction.on_commit(_update_progresses)

            op.status = SubscriptionOperation.STATUS_COMPLETED
            op.result_snapshot = {
                'subscription_id': sub.id,
                'chapter_ids': chapter_ids,
                'price_paid': float(charge_price),
            }
            op.save()

            return True, op.result_snapshot, None

    @staticmethod
    def consume_subscription_for_chapter(user, chapter):
        """
        Low-level helper: списати 1 слот з prepaid пакета для глави.
        Returns: (success, error_code, remaining_after)

        Не використовувати в ChapterPurchaseService.purchase_chapter prepaid flow —
        там логіка виконана inline для атомарності.
        """
        book = chapter.book
        sub = SubscriptionService.get_active_user_subscription_for_book(user, book)
        if not sub:
            return False, None, None

        with transaction.atomic():
            sub = UserBookSubscription.objects.select_for_update().get(pk=sub.pk)
            if sub.remaining_chapters_count <= 0:
                return False, SUBSCRIPTION_EXHAUSTED, None

            new_remaining = sub.remaining_chapters_count - 1
            sub.remaining_chapters_count = new_remaining
            sub.save(update_fields=['remaining_chapters_count', 'updated_at'])

            UserBookSubscriptionUsage.objects.create(
                subscription=sub,
                chapter=chapter,
                usage_type=UserBookSubscriptionUsage.USAGE_TYPE_CONSUME,
                source=UserBookSubscriptionUsage.SOURCE_CHAPTER_BUY_BUTTON,
                chapters_consumed=1,
                remaining_after=new_remaining,
            )

            if new_remaining <= 0:
                sub.status = UserBookSubscription.STATUS_EXHAUSTED
                sub.save(update_fields=['status', 'updated_at'])

        return True, None, new_remaining


class SubscriptionAdminService:
    """Адмінські операції: повернення слота, повернення FanCoins, закриття пакета."""

    @staticmethod
    def restore_slot(subscription_id, chapter_id, admin_user, reason='', request_id=None):
        """
        Повернути 1 слот до prepaid-пакета (відмінити consume).
        Дозволено для active і exhausted пакетів.
        Видаляє UserChapterAccess, якщо доступ було надано цією підпискою.
        """
        with transaction.atomic():
            sub = UserBookSubscription.objects.select_for_update().get(pk=subscription_id)
            if sub.purchase_mode != UserBookSubscription.PURCHASE_MODE_PREPAID:
                return False, 'INVALID_MODE', 'Тільки для prepaid-пакетів'
            if sub.status not in (UserBookSubscription.STATUS_ACTIVE, UserBookSubscription.STATUS_EXHAUSTED):
                return False, 'INVALID_STATUS', 'Пакет має бути active або exhausted'

            usage = UserBookSubscriptionUsage.objects.filter(
                subscription=sub,
                chapter_id=chapter_id,
                usage_type=UserBookSubscriptionUsage.USAGE_TYPE_CONSUME,
                restored_at__isnull=True,
            ).first()
            if not usage:
                return False, 'USAGE_NOT_FOUND', (
                    'Запис consume не знайдено або вже відновлено'
                )

            from django.utils import timezone
            usage.restored_at = timezone.now()
            usage.save(update_fields=['restored_at'])

            sub.remaining_chapters_count += 1
            if sub.status == UserBookSubscription.STATUS_EXHAUSTED:
                sub.status = UserBookSubscription.STATUS_ACTIVE
            sub.save(update_fields=['remaining_chapters_count', 'status', 'updated_at'])

            UserBookSubscriptionUsage.objects.create(
                subscription=sub,
                chapter_id=chapter_id,
                usage_type=UserBookSubscriptionUsage.USAGE_TYPE_ADJUSTMENT_RESTORE,
                source=UserBookSubscriptionUsage.SOURCE_ADMIN_PANEL,
                chapters_consumed=0,
                remaining_after=sub.remaining_chapters_count,
            )

            access = UserChapterAccess.objects.filter(
                user=sub.user,
                chapter_id=chapter_id,
                subscription=sub,
            ).first()
            if access:
                access.delete()

            SubscriptionAdminAuditLog.log(
                operation='restore_slot',
                subscription=sub,
                admin_user=admin_user,
                request_id=request_id,
                payload={'chapter_id': chapter_id, 'reason': reason},
                result={'remaining': sub.remaining_chapters_count},
            )
            logger.info(
                'ADMIN_RESTORE_SLOT: sub=%s chapter=%s admin=%s reason=%s',
                subscription_id, chapter_id, admin_user.id, reason
            )
            return True, sub.remaining_chapters_count, None

    @staticmethod
    def refund_fancoins(subscription_id, admin_user, reason='', request_id=None):
        """
        Повернути FanCoins за пакет.
        З власника списується тільки owner_amount (що він отримав), покупцю повертається price_paid.
        Повторний виклик для вже refunded пакета заборонено.
        """
        with transaction.atomic():
            sub = UserBookSubscription.objects.select_for_update().get(pk=subscription_id)
            if sub.status == UserBookSubscription.STATUS_REFUNDED:
                return False, None, 'ALREADY_REFUNDED'
            if SubscriptionAdminAuditLog.objects.filter(
                subscription=sub,
                operation='refund_fancoins',
            ).exists():
                return False, None, 'ALREADY_REFUNDED'

            profile = sub.user.profile
            owner_profile = sub.book.owner.profile
            price_paid = sub.price_paid
            commission = owner_profile.calculate_commission_amount(price_paid)
            owner_amount = price_paid - commission

            owner_profile.balance_operation(owner_amount, 'purchase')
            profile.balance_operation(price_paid, 'deposit')

            sub.status = UserBookSubscription.STATUS_REFUNDED
            sub.save(update_fields=['status', 'updated_at'])

            SubscriptionAdminAuditLog.log(
                operation='refund_fancoins',
                subscription=sub,
                admin_user=admin_user,
                request_id=request_id,
                payload={'reason': reason, 'price_paid': float(price_paid), 'owner_amount': float(owner_amount)},
                result={'buyer_new_balance': float(profile.balance)},
            )
            logger.info(
                'ADMIN_REFUND_FANCOINS: sub=%s price_paid=%s owner_amount=%s admin=%s reason=%s',
                subscription_id, price_paid, owner_amount, admin_user.id, reason
            )
            profile.refresh_from_db()
            return True, float(profile.balance), None

    @staticmethod
    def close_pack(subscription_id, admin_user, reason='', request_id=None):
        """Закрити пакет (status=cancelled)."""
        with transaction.atomic():
            sub = UserBookSubscription.objects.select_for_update().get(pk=subscription_id)
            prev_status = sub.status
            sub.status = UserBookSubscription.STATUS_CANCELLED
            sub.save(update_fields=['status', 'updated_at'])

            SubscriptionAdminAuditLog.log(
                operation='close_pack',
                subscription=sub,
                admin_user=admin_user,
                request_id=request_id,
                payload={'reason': reason, 'previous_status': prev_status},
                result={'status': sub.status},
            )
            logger.info(
                'ADMIN_CLOSE_PACK: sub=%s admin=%s reason=%s',
                subscription_id, admin_user.id, reason
            )
            return True, None


class ChapterPurchaseService:
    """Єдиний сервіс покупки глави (інтегрує баланс + пакет)."""

    @staticmethod
    def purchase_chapter(user, chapter_id, idempotency_key, request_id=None, use_balance=False):
        """
        Купити главу: спочатку перевірка вже купленої, потім пакет (якщо use_balance=False), інакше баланс.
        use_balance=True — пропустити пакет, купити тільки за баланс.
        idempotency_key обов'язковий — без нього ідемпотентність неможлива.
        request_id — для audit_metadata.
        Returns: (success, data_dict, error_code, error_message)
        """
        if not idempotency_key or not str(idempotency_key).strip():
            raise ValueError('idempotency_key обов\'язковий для purchase_chapter')
        try:
            chapter = Chapter.objects.select_related('book', 'book__owner').get(pk=chapter_id)
        except Chapter.DoesNotExist:
            return False, None, CHAPTER_NOT_FOUND, 'Chapter not found'

        book = chapter.book
        profile = user.profile

        if book.owner_id == user.id:
            return False, None, ACCESS_DENIED, 'Cannot buy own chapter'

        if not chapter.is_paid or chapter.price <= 0:
            return False, None, INVALID_CHAPTER_SELECTION, 'Chapter is free'

        is_allowed, err = check_book_access_permission(user, book, 'download')
        if not is_allowed:
            return False, None, ACCESS_DENIED, err or 'Access denied'

        # Окрема покупка кожної глави завжди дозволена (ціна зазначається при створенні глави).
        def _update_progress():
            from apps.monitoring.models import UserChapterProgress
            UserChapterProgress.objects.update_or_create(
                user=user,
                chapter=chapter,
                defaults={'is_purchased': True}
            )

        with transaction.atomic():
            op, _ = SubscriptionOperation.objects.select_for_update().get_or_create(
                user=user,
                operation_type='purchase_chapter',
                idempotency_key=idempotency_key,
                defaults={
                    'status': SubscriptionOperation.STATUS_PENDING,
                    'payload_snapshot': {'chapter_id': chapter_id}
                }
            )
            if op.status == SubscriptionOperation.STATUS_COMPLETED:
                return True, op.result_snapshot, None, None
            if op.status == SubscriptionOperation.STATUS_FAILED:
                return False, None, op.error_code, str(op.result_snapshot or op.error_code)

            profile = Profile.objects.select_for_update().get(pk=profile.pk)
            if user_has_chapter_access(user, chapter_id):
                result = {
                    'message': 'Глава вже придбана',
                    'is_purchased': True,
                    'chapter_id': chapter_id,
                }
                op.status = SubscriptionOperation.STATUS_COMPLETED
                op.result_snapshot = result
                op.save()
                return True, result, None, None

            sub = None
            if not use_balance:
                try:
                    sub = SubscriptionService.get_active_user_subscription_for_book(user, book)
                except ValueError as e:
                    if str(e) == MULTIPLE_ACTIVE_PREPAID:
                        op.status = SubscriptionOperation.STATUS_FAILED
                        op.error_code = MULTIPLE_ACTIVE_PREPAID
                        op.save()
                        return False, None, MULTIPLE_ACTIVE_PREPAID, 'Multiple active prepaid packs'
                    raise
            if sub:
                sub = UserBookSubscription.objects.select_for_update().get(pk=sub.pk)
                if sub.remaining_chapters_count <= 0:
                    op.status = SubscriptionOperation.STATUS_FAILED
                    op.error_code = SUBSCRIPTION_EXHAUSTED
                    op.save()
                    return False, None, SUBSCRIPTION_EXHAUSTED, 'Пакет вичерпано'

                sid = transaction.savepoint()
                try:
                    UserChapterAccess.objects.create(
                        user=user,
                        chapter=chapter,
                        book=book,
                        source=UserChapterAccess.SOURCE_PREPAID,
                        subscription=sub,
                    )
                except IntegrityError:
                    transaction.savepoint_rollback(sid)
                    result = {
                        'message': 'Глава вже придбана',
                        'is_purchased': True,
                        'chapter_id': chapter_id,
                        'subscription_remaining': sub.remaining_chapters_count,
                    }
                    op.status = SubscriptionOperation.STATUS_COMPLETED
                    op.result_snapshot = result
                    op.save()
                    transaction.on_commit(_update_progress)
                    return True, result, None, None
                transaction.savepoint_commit(sid)

                new_remaining = sub.remaining_chapters_count - 1
                sub.remaining_chapters_count = new_remaining
                update_fields = ['remaining_chapters_count', 'updated_at']
                if new_remaining <= 0:
                    sub.status = UserBookSubscription.STATUS_EXHAUSTED
                    update_fields.append('status')
                sub.save(update_fields=update_fields)

                UserBookSubscriptionUsage.objects.create(
                    subscription=sub,
                    chapter=chapter,
                    usage_type=UserBookSubscriptionUsage.USAGE_TYPE_CONSUME,
                    source=UserBookSubscriptionUsage.SOURCE_CHAPTER_BUY_BUTTON,
                    chapters_consumed=1,
                    remaining_after=new_remaining,
                )

                result = {
                    'message': 'Глава придбана за пакет',
                    'new_balance': float(profile.balance),
                    'chapter_id': chapter_id,
                    'is_purchased': True,
                    'subscription_remaining': new_remaining,
                }
                op.status = SubscriptionOperation.STATUS_COMPLETED
                op.result_snapshot = result
                op.save()
                transaction.on_commit(_update_progress)
                return True, result, None, None

            settings = None
            try:
                settings = BookSubscriptionSettings.objects.get(book=book)
            except BookSubscriptionSettings.DoesNotExist:
                pass
            chapter_price = _get_chapter_price_for_purchase(chapter, settings)
            if profile.balance < chapter_price:
                op.status = SubscriptionOperation.STATUS_FAILED
                op.error_code = INSUFFICIENT_BALANCE
                op.save()
                return False, None, INSUFFICIENT_BALANCE, (
                    f'Недостатньо коштів. Потрібно: {chapter_price} FanCoins, '
                    f'доступно: {profile.balance} FanCoins'
                )

            owner_profile = book.owner.profile
            commission = owner_profile.calculate_commission_amount(chapter_price)
            owner_amount = chapter_price - commission
            balance_before = float(profile.balance)
            sid = transaction.savepoint()
            profile.balance_operation(chapter_price, 'purchase')
            owner_profile.balance_operation(owner_amount, 'earning')
            profile.refresh_from_db()
            balance_after = float(profile.balance)

            audit = {
                'balance_before': balance_before,
                'balance_after': balance_after,
            }
            if request_id:
                audit['request_id'] = request_id
            TransactionLog.objects.create(
                buyer=profile,
                owner=owner_profile,
                chapter=chapter,
                book=book,
                original_price=chapter_price,
                commission_percent=owner_profile.commission,
                commission_amount=commission,
                final_amount=owner_amount,
                audit_metadata=audit
            )

            try:
                UserChapterAccess.objects.create(
                    user=user,
                    chapter=chapter,
                    book=book,
                    source=UserChapterAccess.SOURCE_BALANCE,
                    subscription=None,
                )
            except IntegrityError:
                transaction.savepoint_rollback(sid)
                result = {
                    'message': 'Глава вже придбана',
                    'is_purchased': True,
                    'chapter_id': chapter_id,
                }
                op.status = SubscriptionOperation.STATUS_COMPLETED
                op.result_snapshot = result
                op.save()
                transaction.on_commit(_update_progress)
                return True, result, None, None

            transaction.savepoint_commit(sid)

            result = {
                'message': 'Глава успішно придбана',
                'new_balance': float(profile.balance),
                'chapter_id': chapter_id,
                'is_purchased': True,
                'chapter_title': chapter.title,
                'price_paid': float(chapter_price)
            }
            op.status = SubscriptionOperation.STATUS_COMPLETED
            op.result_snapshot = result
            op.save()
            transaction.on_commit(_update_progress)

            profile.refresh_from_db()
            return True, result, None, None
