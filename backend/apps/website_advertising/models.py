from django.db import models
from apps.users.models import User
from apps.catalog.models import Book


class Advertisement(models.Model):
    LOCATION_CHOICES = [
        ("main", "Головна сторінка"),
        ("catalog", "Каталог"),
        ("search", "Пошук"),
    ]

    TARGET_KIND_CHOICES = [
        ("none", "Без таргету"),
        ("genre", "Жанр"),
        ("tag", "Тег"),
        ("fandom", "Фендом"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="advertisements")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="advertisements")
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    target_kind = models.CharField(
        max_length=10,
        choices=TARGET_KIND_CHOICES,
        default="none",
    )
    target_id = models.PositiveIntegerField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    total_cost = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Реклама"
        verbose_name_plural = "Реклами"
        indexes = [
            models.Index(fields=["book", "location", "target_kind", "start_date", "end_date"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["location", "target_kind", "start_date", "end_date"]),
            # Публічні видачі main/catalog/search + is_active
            models.Index(
                fields=["location", "is_active", "start_date", "end_date"],
                name="website_adv_loc_act_dates_idx",
            ),
            models.Index(
                fields=["location", "is_active", "target_kind", "target_id"],
                name="website_adv_loc_act_tgt_idx",
            ),
        ]

    def __str__(self):
        return f"Реклама для {self.book.title} від {self.user.username}"

    def clean(self):
        from . import services

        services.validate_date_order(self.start_date, self.end_date)
        if self._state.adding:
            services.validate_new_campaign_start_not_in_past(self.start_date)

        services.validate_location_target_pair(
            self.location, self.target_kind, self.target_id
        )
        services.assert_no_overlap(
            self.book,
            self.location,
            self.target_kind,
            self.target_id,
            self.start_date,
            self.end_date,
            exclude_pk=self.pk,
        )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
