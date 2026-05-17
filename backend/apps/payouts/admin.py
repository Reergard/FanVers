import io

from django.contrib import admin
from django.http import HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.utils import timezone
from django.utils.html import format_html

from .models import PayoutBatch, PayoutMethod, PayoutProfile, PayoutRequest
from .services.csv_export import generate_wise_csv
from .services.csv_import import import_wise_reconciliation_csv


class PayoutMethodInline(admin.TabularInline):
    model = PayoutMethod
    extra = 0
    readonly_fields = (
        "created_at",
        "updated_at",
        "last_used_at",
        "successful_payouts_count",
    )


@admin.register(PayoutProfile)
class PayoutProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "legal_status",
        "country",
        "verification_status",
        "payout_approved",
    )
    list_filter = ("verification_status", "payout_approved", "legal_status", "country")
    search_fields = ("user__username", "user__email", "full_name_latin")
    readonly_fields = ("created_at", "updated_at", "submitted_at", "verified_at")
    inlines = [PayoutMethodInline]
    actions = ["approve_profiles", "reject_profiles"]

    @admin.action(description="Схвалити вибрані профілі")
    def approve_profiles(self, request, queryset):
        queryset.update(
            verification_status=PayoutProfile.VerificationStatus.APPROVED,
            payout_approved=True,
            verified_at=timezone.now(),
        )

    @admin.action(description="Відхилити вибрані профілі")
    def reject_profiles(self, request, queryset):
        queryset.update(
            verification_status=PayoutProfile.VerificationStatus.REJECTED,
            payout_approved=False,
        )


@admin.register(PayoutRequest)
class PayoutRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "get_username",
        "coins_amount",
        "amount_net",
        "status",
        "created_at",
        "deadline_at",
        "deadline_status",
    )
    list_filter = ("status", "created_at")
    search_fields = ("profile__user__username", "wise_transfer_id", "invoice_number")
    readonly_fields = (
        "coins_amount",
        "commission_percent",
        "commission_coins",
        "coins_after_commission",
        "exchange_rate",
        "amount_gross",
        "withholding_tax_rate",
        "withholding_tax_amount",
        "amount_net",
        "snapshot_recipient_name",
        "snapshot_iban",
        "snapshot_bic_swift",
        "snapshot_method_type",
        "auto_check_result",
        "idempotency_key",
        "created_at",
        "auto_checked_at",
        "approved_at",
        "processed_at",
        "completed_at",
        "balance_log",
    )
    actions = [
        "create_wise_batch",
        "mark_batch_sent",
        "approve_requests",
        "cancel_requests",
    ]

    @admin.display(description="Автор")
    def get_username(self, obj):
        return obj.profile.user.username

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
        queryset.filter(status__in=["pending", "awaiting_review"]).update(
            status="approved",
            approved_at=timezone.now(),
        )

    @admin.action(description="Скасувати вибрані запити (повернення коштів)")
    def cancel_requests(self, request, queryset):
        from .services.payout_cancel import cancel_payout_request

        cancelled = 0
        for req in queryset.filter(
            status__in=["pending", "awaiting_review", "approved"]
        ):
            try:
                cancel_payout_request(req, "Скасовано адміністратором")
                cancelled += 1
            except Exception:
                pass
        self.message_user(request, f"Скасовано {cancelled} запитів, кошти повернуто.")

    @admin.action(description="Створити batch для Wise (CSV)")
    def create_wise_batch(self, request, queryset):
        approved = queryset.filter(status="approved")
        if not approved.exists():
            self.message_user(
                request,
                "Немає схвалених запитів для batch.",
                level="warning",
            )
            return

        request_ids = list(approved.values_list("id", flat=True))

        batch = PayoutBatch.objects.create(
            name=f"{timezone.now().strftime('%Y-%m-%d')} batch",
            total_count=len(request_ids),
            created_by=request.user,
        )

        total = sum(req.amount_net for req in approved)
        batch.total_amount_by_currency = {"UAH": str(total)}

        approved.update(batch=batch, status="in_batch")

        requests_for_csv = PayoutRequest.objects.filter(id__in=request_ids)
        csv_content = generate_wise_csv(requests_for_csv)

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
        in_batch = queryset.filter(status="in_batch")
        batch_ids = list(
            in_batch.values_list("batch_id", flat=True).distinct()
        )
        updated = in_batch.update(
            status="processing",
            processed_at=timezone.now(),
        )
        PayoutBatch.objects.filter(id__in=batch_ids).update(
            status=PayoutBatch.Status.SENT_TO_WISE,
            sent_at=timezone.now(),
        )
        self.message_user(request, f"{updated} запитів позначено як processing.")


@admin.register(PayoutBatch)
class PayoutBatchAdmin(admin.ModelAdmin):
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

    @admin.display(description="Reconciliation")
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
            results = import_wise_reconciliation_csv(content)
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
