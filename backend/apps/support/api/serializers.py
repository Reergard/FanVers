import re

from rest_framework import serializers

from ..models import SupportTicket


def _sanitize_plain_text(value: str, max_length: int) -> str:
    s = (value or "").replace("\x00", "").strip()
    s = re.sub(r"<[^>]*>", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_length:
        s = s[:max_length]
    return s


def _sanitize_message_text(value: str, max_length: int) -> str:
    """Прибирає HTML і нуль-байти, зберігає переноси рядків та абзаци."""
    s = (value or "").replace("\x00", "")
    s = re.sub(r"<[^>]*>", "", s)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in s.split("\n")]
    s = "\n".join(lines)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    if len(s) > max_length:
        s = s[:max_length]
    return s


class SupportTicketCreateSerializer(serializers.Serializer):
    """
    Тільки поля з форми. Статус, пріоритет, user id тощо не приймаються.
    `website` — honeypot (має бути порожнім).
    """

    category = serializers.ChoiceField(choices=SupportTicket.Category.choices)
    subject = serializers.CharField(min_length=3, max_length=255)
    message = serializers.CharField(min_length=20, max_length=8000)
    name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    email = serializers.EmailField(required=False, allow_blank=True)
    website = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        write_only=True,
        help_text="Honeypot",
    )
    page_url = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_website(self, value):
        if value and str(value).strip():
            raise serializers.ValidationError("Invalid payload.")
        return value

    def validate_subject(self, value):
        s = _sanitize_plain_text(value, 255)
        if len(s) < 3:
            raise serializers.ValidationError("Тема занадто коротка.")
        return s

    def validate_message(self, value):
        s = _sanitize_message_text(value, 8000)
        if len(s) < 20:
            raise serializers.ValidationError("Повідомлення занадто коротке.")
        return s

    def validate_name(self, value):
        if not value:
            return ""
        return _sanitize_plain_text(value, 120)

    def validate_page_url(self, value):
        if not value:
            return ""
        return _sanitize_plain_text(value, 500)

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            if not (attrs.get("email") or "").strip():
                raise serializers.ValidationError(
                    {"email": "Вкажіть email для відповіді."}
                )
            if not (attrs.get("name") or "").strip():
                raise serializers.ValidationError(
                    {"name": "Вкажіть ім'я або нік."}
                )
        return attrs
