"""
Тесты авторизации: ротация refresh, blacklist после logout, CSRF для refresh,
время жизни access (15 мин) и refresh (7 дн), 401 без cookie.
"""
import base64
import json
import time
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

User = get_user_model()

# Префикс API из FanVers_project/urls.py и apps/api/urls.py
API_USERS = "/api/users"


def _jwt_payload(token_str: str) -> dict:
    """Декодировать payload JWT (вторая часть)."""
    try:
        part = token_str.split(".")[1]
        pad = 4 - len(part) % 4
        if pad != 4:
            part += "=" * pad
        return json.loads(base64.urlsafe_b64decode(part))
    except Exception:
        return {}


class AuthFlowTestCase(TestCase):
    """Логин, refresh, logout, ротация, blacklist, CSRF, lifetimes."""

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username="testuser_auth",
            email="auth@test.example",
            password="testpass123",
            is_active=True,
        )

    def _get_csrf(self):
        r = self.client.get(f"{API_USERS}/csrf/")
        self.assertEqual(r.status_code, 200)
        csrf = r.json().get("csrfToken")
        if not csrf and "csrftoken" in self.client.cookies:
            csrf = self.client.cookies["csrftoken"].value
        return csrf

    def _login(self):
        r = self.client.post(
            f"{API_USERS}/login/",
            data=json.dumps({"username": "testuser_auth", "password": "testpass123"}),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        return r

    def _refresh(self, csrf_token: str):
        r = self.client.post(
            f"{API_USERS}/refresh/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        return r

    def _logout(self, csrf_token: str):
        return self.client.post(
            f"{API_USERS}/logout/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

    def test_no_refresh_cookie_returns_401(self):
        """POST /refresh/ без cookie refresh_token → 401."""
        self._get_csrf()
        csrf = self._get_csrf()
        r = self.client.post(
            f"{API_USERS}/refresh/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(r.status_code, 401)

    def test_refresh_requires_csrf(self):
        """POST /refresh/ без X-CSRFToken (при включённой CSRF) → 403."""
        self._login()
        r = self.client.post(
            f"{API_USERS}/refresh/",
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertIn(r.status_code, (403, 401))

    def test_refresh_rotation_old_token_invalid(self):
        """После refresh старый refresh-токен не принимается (ротация + blacklist)."""
        self._get_csrf()
        login_resp = self._login()
        refresh_cookie = login_resp.cookies.get("refresh_token")
        self.assertTrue(refresh_cookie, "login должен выдать refresh cookie")
        old_refresh_value = refresh_cookie.value

        csrf = self._get_csrf()
        r1 = self.client.post(
            f"{API_USERS}/refresh/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(r1.status_code, 200, r1.content)

        self.client.cookies["refresh_token"] = old_refresh_value
        r2 = self.client.post(
            f"{API_USERS}/refresh/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self._get_csrf(),
        )
        self.assertEqual(r2.status_code, 401)

    def test_blacklist_after_logout(self):
        """После logout refresh из логина не принимается (logout блэклистит токен)."""
        self._get_csrf()
        login_resp = self._login()
        refresh_val = login_resp.cookies.get("refresh_token").value

        self._logout(self._get_csrf())

        self.client.cookies["refresh_token"] = refresh_val
        r_after = self.client.post(
            f"{API_USERS}/refresh/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self._get_csrf(),
        )
        self.assertEqual(r_after.status_code, 401)

    def test_access_token_lifetime_about_15min(self):
        """Access token exp ≈ now + 15 min (exp в UTC, считаем дельту в секундах)."""
        login_resp = self._login()
        access = login_resp.json().get("access")
        self.assertTrue(access)
        payload = _jwt_payload(access)
        exp = payload.get("exp")
        self.assertTrue(exp, "в access должен быть exp")
        delta = int(exp) - int(time.time())
        self.assertGreaterEqual(delta, 14 * 60)
        self.assertLessEqual(delta, 16 * 60)

    def test_refresh_token_lifetime_about_7d(self):
        """Refresh token exp ≈ now + 7 дней (exp в UTC, считаем дельту в секундах)."""
        refresh = RefreshToken.for_user(self.user)
        payload = _jwt_payload(str(refresh))
        exp = payload.get("exp")
        self.assertTrue(exp)
        delta = int(exp) - int(time.time())
        self.assertGreaterEqual(delta, 6.9 * 24 * 3600)
        self.assertLessEqual(delta, 7.1 * 24 * 3600)
