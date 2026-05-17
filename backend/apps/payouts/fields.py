import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models


def _get_fernet():
    """Створює Fernet-ключ із SECRET_KEY проекту."""
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


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
                return value
        return value
