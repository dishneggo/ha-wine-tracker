"""Tests for HOSTED_MODE: startup guard, hashed users file, session and
cookie hardening, POST-only logout and the request size cap."""
import json
from typing import ClassVar

import app as wine_app
import pytest
from werkzeug.security import generate_password_hash

GOOD_KEY = "a" * 64


# ── validate_hosted_config ───────────────────────────────────────────────────

class TestValidateHostedConfig:
    USERS: ClassVar[dict] = {"diego": {"hash": "pbkdf2:sha256:x", "role": "admin"}}

    def test_good_config_passes(self):
        wine_app.validate_hosted_config(True, GOOD_KEY, self.USERS, "")

    def test_auth_disabled_refused(self):
        with pytest.raises(RuntimeError, match="AUTH_ENABLED"):
            wine_app.validate_hosted_config(False, GOOD_KEY, self.USERS, "")

    @pytest.mark.parametrize("key", ["", "short", "change-this-to-a-random-string"])
    def test_weak_secret_key_refused(self, key):
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            wine_app.validate_hosted_config(True, key, self.USERS, "")

    def test_no_users_refused(self):
        with pytest.raises(RuntimeError, match="at least one user"):
            wine_app.validate_hosted_config(True, GOOD_KEY, {}, "")

    @pytest.mark.parametrize("raw", ["admin:changeme", "diego:short", "a:long-enough-pass,b:admin"])
    def test_placeholder_or_short_plain_password_refused(self, raw):
        users = wine_app.parse_user_string(raw)
        with pytest.raises(RuntimeError, match="placeholder or shorter"):
            wine_app.validate_hosted_config(True, GOOD_KEY, users, raw)

    def test_error_message_does_not_leak_password(self):
        raw = "diego:tinypw1"
        with pytest.raises(RuntimeError) as exc:
            wine_app.validate_hosted_config(True, GOOD_KEY, wine_app.parse_user_string(raw), raw)
        assert "tinypw1" not in str(exc.value)

    def test_error_message_does_not_leak_secret_key(self):
        with pytest.raises(RuntimeError) as exc:
            wine_app.validate_hosted_config(True, "leakycandidate", self.USERS, "")
        assert "leakycandidate" not in str(exc.value)


# ── load_users_file ──────────────────────────────────────────────────────────

class TestUsersFile:
    def _write(self, tmp_path, data):
        p = tmp_path / "users.json"
        p.write_text(json.dumps(data))
        return str(p)

    def test_loads_hashed_users(self, tmp_path):
        h = generate_password_hash("correct horse battery", method="pbkdf2:sha256")
        users = wine_app.load_users_file(self._write(tmp_path, {
            "diego": {"hash": h, "role": "admin"},
            "guest": {"hash": h, "role": "readonly"},
        }))
        assert users["diego"]["role"] == "admin"
        assert users["guest"]["role"] == "readonly"

    def test_role_defaults_to_admin(self, tmp_path):
        h = generate_password_hash("correct horse battery")
        users = wine_app.load_users_file(self._write(tmp_path, {"diego": {"hash": h}}))
        assert users["diego"]["role"] == "admin"

    @pytest.mark.parametrize("data", [
        [],
        {"diego": "plaintext"},
        {"diego": {"hash": "plaintext-password"}},
        {"diego": {"hash": "pbkdf2:sha256:x", "role": "root"}},
        {" ": {"hash": "pbkdf2:sha256:x"}},
    ])
    def test_rejects_bad_files(self, tmp_path, data):
        with pytest.raises(ValueError):
            wine_app.load_users_file(self._write(tmp_path, data))


# ── Session behaviour ────────────────────────────────────────────────────────

@pytest.fixture
def auth_client(app):
    wine_app.AUTH_ENABLED = True
    wine_app._USERS = {
        "diego": {"hash": generate_password_hash("correct horse battery"), "role": "admin"},
    }
    app.secret_key = "test-secret"
    yield app.test_client()
    wine_app.AUTH_ENABLED = False
    wine_app._USERS = {}


class TestSessions:
    def test_unauthenticated_page_redirects(self, auth_client):
        resp = auth_client.get("/")
        assert resp.status_code == 302
        assert "/login" in resp.headers["Location"]

    def test_unauthenticated_api_401(self, auth_client):
        resp = auth_client.get("/api/ai-settings")
        assert resp.status_code == 401

    def test_login_clears_previous_session(self, auth_client):
        with auth_client.session_transaction() as s:
            s["planted"] = "attacker-value"
        auth_client.post("/login", data={"username": "diego", "password": "correct horse battery"})
        with auth_client.session_transaction() as s:
            assert s.get("user") == "diego"
            assert "planted" not in s

    def test_wrong_password_no_session(self, auth_client):
        auth_client.post("/login", data={"username": "diego", "password": "nope"})
        with auth_client.session_transaction() as s:
            assert "user" not in s

    def test_logout_get_not_allowed(self, auth_client):
        auth_client.post("/login", data={"username": "diego", "password": "correct horse battery"})
        assert auth_client.get("/logout").status_code == 405
        with auth_client.session_transaction() as s:
            assert s.get("user") == "diego"  # a GET (e.g. an <img> on another site) cannot log you out

    def test_logout_post_clears_session(self, auth_client):
        auth_client.post("/login", data={"username": "diego", "password": "correct horse battery"})
        resp = auth_client.post("/logout")
        assert resp.status_code == 302
        with auth_client.session_transaction() as s:
            assert "user" not in s

    def test_settings_modal_uses_post_logout(self, auth_client):
        auth_client.post("/login", data={"username": "diego", "password": "correct horse battery"})
        html = auth_client.get("/").get_data(as_text=True)
        assert 'method="post" action="/logout"' in html
        assert 'href="/logout"' not in html


class TestHostedCookies:
    def test_cookie_flags_when_hosted(self, auth_client, app, monkeypatch):
        monkeypatch.setitem(app.config, "SESSION_COOKIE_SECURE", True)
        monkeypatch.setitem(app.config, "SESSION_COOKIE_SAMESITE", "Lax")
        monkeypatch.setitem(app.config, "SESSION_COOKIE_HTTPONLY", True)
        monkeypatch.setattr(wine_app, "HOSTED_MODE", True)
        resp = auth_client.post("/login", data={"username": "diego", "password": "correct horse battery"},
                                base_url="https://wine.example")
        cookie = resp.headers.get("Set-Cookie", "")
        assert "Secure" in cookie
        assert "HttpOnly" in cookie
        assert "SameSite=Lax" in cookie
        assert "Expires=" in cookie  # permanent session in hosted mode


class TestBodyLimit:
    def test_oversized_api_body_413_json(self, client, app, monkeypatch):
        monkeypatch.setitem(app.config, "MAX_CONTENT_LENGTH", 1024)
        resp = client.post("/api/prefs", data=b"x" * 4096,
                           headers={"Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest"})
        assert resp.status_code == 413
        assert resp.get_json()["error"] == "too_large"

    def test_oversized_form_413_text(self, client, app, monkeypatch):
        monkeypatch.setitem(app.config, "MAX_CONTENT_LENGTH", 1024)
        resp = client.post("/add", data={"name": "x" * 4096})
        assert resp.status_code == 413


# ── Startup guard at import time ─────────────────────────────────────────────

class TestImportGuard:
    def _run(self, env, tmp_path):
        import os
        import subprocess
        import sys
        app_dir = os.path.join(os.path.dirname(__file__), "..", "app")
        full = {"PATH": os.environ.get("PATH", ""), "DATA_DIR": str(tmp_path / "d"), **env}
        return subprocess.run([sys.executable, "-c", "import app"], check=False, cwd=app_dir, env=full,
                              capture_output=True, text=True, timeout=60)

    def test_hosted_without_auth_fails(self, tmp_path):
        r = self._run({"HOSTED_MODE": "1"}, tmp_path)
        assert r.returncode != 0
        assert "HOSTED_MODE refuses to start" in r.stderr

    def test_hosted_with_dev_auth_fails(self, tmp_path):
        r = self._run({"HOSTED_MODE": "1", "DEV_AUTH": "a:b", "SECRET_KEY": GOOD_KEY}, tmp_path)
        assert r.returncode != 0
        assert "DEV_AUTH" in r.stderr

    def test_hosted_with_good_users_file_starts(self, tmp_path):
        p = tmp_path / "users.json"
        p.write_text(json.dumps({"diego": {"hash": generate_password_hash("correct horse battery")}}))
        r = self._run({"HOSTED_MODE": "1", "AUTH_ENABLED": "true", "SECRET_KEY": GOOD_KEY,
                       "USERS_FILE": str(p)}, tmp_path)
        assert r.returncode == 0, r.stderr
