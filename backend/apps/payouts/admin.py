import io
from decimal import Decimal

from django.contrib import admin
from unfold.admin import ModelAdmin
from django.http import HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.db import transaction
from django.utils import timezone
from django.utils.html import format_html

from .models import PayoutBatch, PayoutMethod, PayoutProfile, PayoutRequest
from .services.csv_export import generate_wise_csv
from .services.csv_import import import_wise_reconciliation_csv


@admin.register(PayoutRequest)
class PayoutRequestAdmin(ModelAdmin):
    list_display = (
        "display_id",
        "get_username",
        "urgent_badge",
        "coins_amount",
        "amount_net",
        "commission_percent",
        "commission_coins",
        "payout_currency",
        "status",
        "created_at",
        "deadline_at",
        "deadline_status",
    )
    list_display_links = (
        "display_id",
        "get_username",
        "coins_amount",
        "amount_net",
        "payout_currency",
        "status",
        "created_at",
        "deadline_at",
    )
    list_filter = ("status", "is_urgent", "created_at", "payout_currency")
    ordering = ("-is_urgent", "-created_at")
    search_fields = (
        "profile__user__username",
        "profile__user__email",
        "snapshot_full_name_latin",
        "wise_transfer_id",
        "invoice_number",
    )
    readonly_fields = (
        "get_username",
        "get_user_email",
        "is_urgent",
        # KYC snapshot
        "snapshot_country",
        "snapshot_full_name_legal",
        "snapshot_full_name_latin",
        "snapshot_address_line",
        "snapshot_city",
        "snapshot_postal_code",
        # Реквізити
        "snapshot_recipient_name",
        "snapshot_iban_masked",
        "snapshot_bic_swift",
        "snapshot_method_type",
        # Фінанси
        "coins_amount",
        "commission_percent",
        "commission_coins",
        "coins_after_commission",
        "exchange_rate",
        "amount_gross",
        "withholding_tax_rate",
        "withholding_tax_amount",
        "amount_net",
        "payout_currency",
        # Системне
        "idempotency_key",
        "created_at",
        "approved_at",
        "approved_by",
        "processed_at",
        "completed_at",
        "balance_log",
    )
    fieldsets = (
        ("Користувач", {
            "fields": ("get_username", "get_user_email"),
        }),
        ("KYC-дані (на момент заявки)", {
            "fields": (
                "snapshot_country",
                "snapshot_full_name_legal",
                "snapshot_full_name_latin",
                "snapshot_address_line",
                "snapshot_city",
                "snapshot_postal_code",
            ),
        }),
        ("Реквізити (на момент заявки)", {
            "fields": (
                "snapshot_recipient_name",
                "snapshot_iban_masked",
                "snapshot_bic_swift",
                "snapshot_method_type",
            ),
        }),
        ("Фінанси", {
            "fields": (
                "coins_amount",
                "commission_percent",
                "commission_coins",
                "coins_after_commission",
                "payout_currency",
                "exchange_rate",
                "amount_gross",
                "withholding_tax_rate",
                "withholding_tax_amount",
                "amount_net",
            ),
        }),
        ("Статус і обробка", {
            "fields": (
                "is_urgent",
                "status",
                "approved_by",
                "wise_transfer_id",
                "failure_reason",
                "admin_notes",
                "invoice_number",
                "invoice_pdf",
            ),
        }),
        ("Дати", {
            "fields": (
                "created_at",
                "approved_at",
                "processed_at",
                "completed_at",
                "deadline_at",
            ),
        }),
        ("Системне", {
            "classes": ("collapse",),
            "fields": (
                "idempotency_key",
                "balance_log",
            ),
        }),
    )
    actions = [
        "approve_requests",
        "create_wise_batch",
        "mark_batch_sent",
        "mark_as_paid",
        "cancel_requests",
    ]

    def get_actions(self, request):
        actions = super().get_actions(request)
        delete_action = actions.get("delete_selected")
        if delete_action is not None:
            actions["delete_selected"] = (
                delete_action[0],
                delete_action[1],
                "Видалити запит на виплату",
            )
        return actions

    @admin.display(description="№", ordering="id")
    def display_id(self, obj):
        return obj.pk

    @admin.display(description="Користувач")
    def get_username(self, obj):
        return obj.profile.user.username

    @admin.display(description="Email")
    def get_user_email(self, obj):
        return obj.profile.user.email

    @admin.display(description="IBAN (маскований)")
    def snapshot_iban_masked(self, obj):
        iban = obj.snapshot_iban
        if iban and not iban.startswith("["):
            visible = max(4, len(iban) // 4)
            return iban[:visible] + "****" + iban[-2:]
        return iban or "-"

    @admin.display(description="⚡", boolean=False)
    def urgent_badge(self, obj):
        if obj.is_urgent:
            return format_html(
                '<span style="color:#fff;background:#e74c3c;padding:2px 8px;'
                'border-radius:4px;font-weight:bold;font-size:0.85em">'
                '⚡ ТЕРМІНОВО</span>'
            )
        return ""

    @admin.display(description="Дедлайн")
    def deadline_status(self, obj):
        if obj.status in ("completed", "cancelled", "failed"):
            return "-"
        now = timezone.now()
        if obj.deadline_at < now:
            return format_html(
                '<span style="color:red;font-weight:bold">ПРОСТРОЧЕНО</span>'
            )
        days_left = (obj.deadline_at - now).days
        if days_left <= 3:
            return format_html('<span style="color:orange">{} дн</span>', days_left)
        return f"{days_left} дн"

    @admin.action(description="Схвалити вибрані запити")
    def approve_requests(self, request, queryset):
        with transaction.atomic():
            eligible = queryset.filter(status__in=["pending", "awaiting_review"])
            profile_ids = list(eligible.values_list("profile_id", flat=True).distinct())
            updated = eligible.update(
                status="approved",
                approved_at=timezone.now(),
                approved_by=request.user,
            )
            PayoutProfile.objects.filter(
                id__in=profile_ids,
                verification_status=PayoutProfile.VerificationStatus.PENDING,
            ).update(
                verification_status=PayoutProfile.VerificationStatus.APPROVED,
                payout_approved=True,
                verified_at=timezone.now(),
            )
        self.message_user(request, f"Схвалено {updated} запитів.")

    @admin.action(description="Скасувати вибрані запити (повернення коштів)")
    def cancel_requests(self, request, queryset):
        import logging

        from .services.payout_cancel import cancel_payout_request

        logger = logging.getLogger(__name__)
        cancelled = 0
        errors = []
        for req in queryset.filter(
            status__in=["pending", "awaiting_review", "approved"]
        ):
            try:
                cancel_payout_request(req, "Скасовано адміністратором")
                cancelled += 1
            except Exception as e:
                logger.error("Помилка скасування запиту #%s: %s", req.id, e)
                errors.append(f"#{req.id}: {e}")
        msg = f"Скасовано {cancelled} запитів, кошти повернуто."
        if errors:
            msg += f" Помилки ({len(errors)}): {'; '.join(errors)}"
            self.message_user(request, msg, level="warning")
        else:
            self.message_user(request, msg)

    @admin.action(description="Створити batch для Wise (CSV)")
    def create_wise_batch(self, request, queryset):
        with transaction.atomic():
            approved = (
                queryset.filter(status="approved")
                .select_for_update()
            )
            request_ids = list(approved.values_list("id", flat=True))
            if not request_ids:
                self.message_user(
                    request,
                    "Немає схвалених запитів для batch.",
                    level="warning",
                )
                return

            batch = PayoutBatch.objects.create(
                name=f"{timezone.now().strftime('%Y-%m-%d')} batch",
                total_count=len(request_ids),
                created_by=request.user,
            )

            approved_qs = PayoutRequest.objects.filter(id__in=request_ids)
            totals_by_currency = {}
            for req in approved_qs:
                cur = req.payout_currency
                totals_by_currency[cur] = totals_by_currency.get(cur, Decimal("0")) + req.amount_net
            batch.total_amount_by_currency = {
                cur: str(amt) for cur, amt in totals_by_currency.items()
            }

            approved_qs.update(batch=batch, status="in_batch")

            csv_content = generate_wise_csv(
                PayoutRequest.objects.filter(id__in=request_ids)
            )

            batch.csv_file.save(
                f"wise_batch_{batch.id}.csv",
                io.BytesIO(csv_content.encode("utf-8")),
            )
            batch.status = PayoutBatch.Status.CSV_GENERATED
            batch.csv_generated_at = timezone.now()
            batch.save()

        response = HttpResponse(csv_content, content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="wise_batch_{batch.id}.csv"'
        )
        return response

    @admin.action(description="Позначити batch як відправлений у Wise")
    def mark_batch_sent(self, request, queryset):
        with transaction.atomic():
            in_batch = queryset.filter(status="in_batch")
            batch_ids = list(
                in_batch.values_list("batch_id", flat=True).distinct()
            )
            updated = in_batch.update(
                status="processing",
                processed_at=timezone.now(),
            )
            batches = PayoutBatch.objects.filter(id__in=batch_ids)
            # Видаляємо CSV-файли з диску (містять розшифровані IBAN)
            for b in batches:
                if b.csv_file:
                    try:
                        b.csv_file.storage.delete(b.csv_file.name)
                    except Exception:
                        pass
                    b.csv_file = None
            PayoutBatch.objects.filter(id__in=batch_ids).update(
                status=PayoutBatch.Status.SENT_TO_WISE,
                sent_at=timezone.now(),
                csv_file="",
            )
        self.message_user(request, f"{updated} запитів позначено як processing.")

    @admin.action(description="Позначити виплаченим")
    def mark_as_paid(self, request, queryset):
        import logging

        from apps.payouts.services.payout_complete import mark_payout_request_completed_manual

        logger = logging.getLogger(__name__)
        updated = 0
        skipped = 0
        errors = []

        for req in queryset:
            try:
                with transaction.atomic():
                    mark_payout_request_completed_manual(
                        PayoutRequest.objects.select_for_update().get(pk=req.pk)
                    )
                updated += 1
            except ValueError as exc:
                skipped += 1
                errors.append(f"#{req.id}: {exc}")
            except Exception as exc:
                logger.error("Помилка завершення запиту #%s: %s", req.id, exc)
                errors.append(f"#{req.id}: {exc}")

        if updated:
            self.message_user(request, f"Позначено виплаченими: {updated} запитів.")
        if skipped:
            self.message_user(
                request,
                f"Пропущено: {skipped}. {'; '.join(errors[:5])}",
                level="warning",
            )
        elif errors:
            self.message_user(
                request,
                f"Помилки: {'; '.join(errors[:5])}",
                level="error",
            )
        elif not updated:
            self.message_user(
                request,
                "Немає заявок для завершення (потрібен статус «У batch» або «Відправлений у Wise»).",
                level="warning",
            )


@admin.register(PayoutBatch)
class PayoutBatchAdmin(ModelAdmin):
    list_display = (
        "id",
        "name",
        "status",
        "total_count",
        "completed_count",
        "failed_count",
        "created_at",
        "reconciliation_link",
    )

    @admin.display(description="Звірка")
    def reconciliation_link(self, obj):
        if obj.status in (
            PayoutBatch.Status.SENT_TO_WISE,
            PayoutBatch.Status.PARTIAL,
        ):
            url = f"{obj.pk}/import-reconciliation/"
            return format_html(
                '<a href="{}">Імпорт CSV</a>', url
            )
        return "-"
    list_filter = ("status",)
    readonly_fields = (
        "created_at",
        "csv_generated_at",
        "sent_at",
        "confirmed_at",
        "created_by",
    )

    def get_urls(self):
        from django.urls import path

        urls = super().get_urls()
        custom = [
            path(
                "<int:batch_id>/import-reconciliation/",
                self.admin_site.admin_view(self.import_reconciliation_view),
                name="payouts_payoutbatch_import_reconciliation",
            ),
        ]
        return custom + urls

    def import_reconciliation_view(self, request, batch_id):
        if request.method == "POST" and request.FILES.get("csv_file"):
            csv_file = request.FILES["csv_file"]
            content = csv_file.read().decode("utf-8")
            results = import_wise_reconciliation_csv(content, batch_id=batch_id)
            self.message_user(
                request,
                f"Оновлено: {results['updated']}, помилки: {results['failed']}, "
                f"пропущено: {results['skipped']}",
            )
            return redirect("..")
        return TemplateResponse(
            request,
            "admin/payouts/import_reconciliation.html",
            {"batch_id": batch_id},
        )
