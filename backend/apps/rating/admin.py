from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import BookRating

@admin.register(BookRating)
class BookRatingAdmin(ModelAdmin):
    list_display = ('book', 'user', 'rating_type', 'rating', 'created_at')
    list_filter = ('rating_type', 'rating', 'created_at')
    search_fields = ('book__title', 'user__username')
    raw_id_fields = ('book', 'user')
