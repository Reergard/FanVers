# Generated manually for chat list optimization + ordering

from django.db import migrations, models
import django.db.models.deletion


def backfill_chat_last_message(apps, schema_editor):
    Chat = apps.get_model("chat", "Chat")
    Message = apps.get_model("chat", "Message")
    for chat in Chat.objects.only("id").iterator():
        last = (
            Message.objects.filter(chat_id=chat.id)
            .order_by("-created_at", "-id")
            .first()
        )
        if last:
            Chat.objects.filter(pk=chat.id).update(last_message_id=last.id)


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0004_alter_message_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="chat",
            name="last_message",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="chat.message",
            ),
        ),
        migrations.RunPython(backfill_chat_last_message, migrations.RunPython.noop),
    ]
