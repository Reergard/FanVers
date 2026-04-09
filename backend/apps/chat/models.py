from django.db import models
from django.conf import settings
from django.utils import timezone

class Chat(models.Model):
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='chats'
    )
    last_message = models.ForeignKey(
        "Message",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Chat {self.id} - {', '.join(str(p) for p in self.participants.all())}"

class Message(models.Model):
    chat = models.ForeignKey(
        Chat,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    content = models.TextField(max_length=5000)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(
                fields=["chat", "sender", "created_at"],
                name="msg_chat_sender_created_idx",
            ),
        ]

    def __str__(self):
        return f"{self.sender}: {self.content[:50]}"


class ChatReadStatus(models.Model):
    """Отслеживание времени последнего прочтения чата пользователем"""
    chat = models.ForeignKey(
        Chat,
        on_delete=models.CASCADE,
        related_name='read_statuses'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_read_statuses'
    )
    last_read_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['chat', 'user']
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.username} read chat {self.chat.id} at {self.last_read_at}"