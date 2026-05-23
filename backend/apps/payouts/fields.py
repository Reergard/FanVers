import base64
import hashlib
import logging

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models

logger = logging.getLogger(__name__)


def _make_fernet(source):
    key = hashlib.sha256(source.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def _get_fernet():
    source = getattr(settings, "PAYOUT_ENCRYPTION_KEY", None)
    if not source:
        if getattr(settings, "DEBUG", False):
            source = settings.SECRET_KEY
        else:
            raise RuntimeError(
                "PAYOUT_ENCRYPTION_KEY is not configured. "
                "Set it in environment variables."
            )
    return _make_fernet(source)


def _get_old_fernet():
    """Повертає Fernet зі старого ключа для ротації, або None."""
    old_key = getattr(settings, "PAYOUT_ENCRYPTION_KEY_OLD", None)
    if old_key:
        return _make_fernet(old_key)
    return None


class EncryptedCharField(models.CharField):
    """
    CharField, який зберігає дані зашифрованими в БД (Fernet/AES-128-CBC).

    .filter(iban=...) по зашифрованому полю НЕ працює.
    max_length у БД має бути більшим за plaintext (~3x для Fernet).
    """

    def get_prep_value(self, value):
        if value is not None and value != '':
            return _get_fernet().encrypt(value.encode()).decode()
        return value

    def from_db_value(self, value, expression, connection):
        if value is not None and value != '':
            try:
                return _get_fernet().decrypt(value.encode()).decode()
            except Exception:
                old_fernet = _get_old_fernet()
                if old_fernet:
                    try:
                        return old_fernet.decrypt(value.encode()).decode()
                    except Exception:
                        pass
                logger.error(
                    "Failed to decrypt EncryptedCharField value (len=%d)",
                    len(value),
                )
                return "[DECRYPTION_ERROR]"
        return value
