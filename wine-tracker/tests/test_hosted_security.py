"""Tests for CSRF, origin checks, login throttling, proxy header trust,
upload access control and locked AI settings."""
import re

import app as wine_app
import pytest
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import generate_password_hash

PW = "correct horse battery"


@pytest.fixture(autouse=True)
def _reset_security_state(monkeypatch):
    wine_app._login_fails.clear()
    yield
    wine_app._login_fails.clear()


@pytest.fixture
def auth_client(app):
    wine_app.AUTH_ENABLED = True
    wine_app._USERS = {"diego": {"hash": generate_password_hash(PW), "role": "admin"}}
    app.secret_key = "test-secret"
    yield app.test_client()
    wine_app.AUTH_ENABLED = False
    wine_app._USERS = {}


def _login(c, ip="10.0.0.1", password=PW, user="diego", **kw):
    return c.post("/login", data={"username": user, "password": password, **kw},
                  environ_base={"REMOTE_ADDR": ip})


def _token_from(html):
    m = re.search(r'<meta name="csrf-token" content="([^"]+)"', html)
    assert m, "csrf meta tag missing"
    return m.group(1)


# ── CSRF ─────────────────────────────────────────────────────────────────────

class TestCsrf:
    @pytest.fixture
    def csrf_on(self, app, monkeypatch):
        monkeypatch.setitem(app.config, "WTF_CSRF_ENABLED", True)
        monkeypatch.setitem(app.config, "WTF_CSRF_SSL_STRICT", False)

    def test_api_post_without_token_rejected(self, client, csrf_on):
        resp = client.post("/api/prefs", json={"wineViewMode": "grid"})
        assert resp.status_code == 400
        assert resp.get_json() == {"ok": False, "error": "csrf"}

    def test_api_post_with_header_token_accepted(self, client, csrf_on):
        token = _token_from(client.get("/").get_data(as_text=True))
        resp = client.post("/api/prefs", json={"wineViewMode": "grid"}, headers={"X-CSRFToken": token})
        assert resp.status_code == 200

    def test_api_post_with_wrong_token_rejected(self, client, csrf_on):
        client.get("/")
        resp = client.post("/api/prefs", json={"wineViewMode": "grid"}, headers={"X-CSRFToken": "forged"})
        assert resp.status_code == 400

    def test_login_form_needs_token(self, auth_client, csrf_on):
        assert _login(auth_client).status_code == 400
        html = auth_client.get("/login").get_data(as_text=True)
        token = re.search(r'name="csrf_token" value="([^"]+)"', html).group(1)
        assert _login(auth_client, csrf_token=token).status_code == 302

    @pytest.mark.parametrize("path", ["/", "/stats", "/timeline"])
    def test_pages_ship_meta_and_wrapper(self, client, path):
        html = client.get(path).get_data(as_text=True)
        assert '<meta name="csrf-token"' in html
        assert "/static/csrf.js" in html
        # wrapper must load before the first inline script that may call fetch
        assert html.index("/static/csrf.js") < html.index("</head>")

    def test_chat_template_ships_meta_and_wrapper(self):
        # /chat redirects when no AI provider is configured, so check the template.
        import os
        with open(os.path.join(os.path.dirname(wine_app.__file__), "templates", "chat.html")) as f:
            src = f.read()
        head = src[:src.index("</head>")]
        assert '<meta name="csrf-token" content="{{ csrf_token() }}">' in head
        assert "/static/csrf.js" in head

    def test_login_page_ships_wrapper_and_hidden_field(self, auth_client):
        html = auth_client.get("/login").get_data(as_text=True)
        assert "csrf.js" in html
        assert 'name="csrf_token"' in html

    def test_native_post_forms_have_hidden_token(self, client):
        html = client.get("/").get_data(as_text=True)
        for form_id in ("dupForm", "deleteForm", "wineForm"):
            m = re.search(r'<form[^>]*id="' + form_id + r'"[^>]*>\s*<input type="hidden" name="csrf_token"', html)
            assert m, form_id

    def test_wrapper_js_served(self, client):
        js = client.get("/static/csrf.js").get_data(as_text=True)
        assert "X-CSRFToken" in js
        assert "sameOrigin" in js


# ── Origin check ─────────────────────────────────────────────────────────────

class TestOriginCheck:
    @pytest.fixture(autouse=True)
    def origin(self, monkeypatch):
        monkeypatch.setattr(wine_app, "PUBLIC_ORIGIN", "https://wine.example")

    def test_foreign_origin_rejected(self, client):
        resp = client.post("/api/prefs", json={}, headers={"Origin": "https://evil.example"})
        assert resp.status_code == 403
        assert resp.get_json()["error"] == "bad_origin"

    def test_lookalike_origin_rejected(self, client):
        resp = client.post("/api/prefs", json={}, headers={"Origin": "https://wine.example.evil.example"})
        assert resp.status_code == 403

    def test_matching_origin_allowed(self, client):
        resp = client.post("/api/prefs", json={"wineViewMode": "grid"}, headers={"Origin": "https://wine.example"})
        assert resp.status_code == 200

    def test_foreign_referer_rejected_when_no_origin(self, client):
        resp = client.post("/api/prefs", json={}, headers={"Referer": "https://evil.example/page"})
        assert resp.status_code == 403

    def test_prefix_trick_referer_rejected(self, client):
        resp = client.post("/api/prefs", json={}, headers={"Referer": "https://wine.example.evil.example/"})
        assert resp.status_code == 403

    def test_same_site_referer_allowed(self, client):
        resp = client.post("/api/prefs", json={"wineViewMode": "grid"},
                           headers={"Referer": "https://wine.example/stats"})
        assert resp.status_code == 200

    def test_get_not_checked(self, client):
        assert client.get("/", headers={"Origin": "https://evil.example"}).status_code == 200


# ── Login throttling ─────────────────────────────────────────────────────────

class TestLoginThrottle:
    def test_sixth_attempt_throttled_even_with_right_password(self, auth_client):
        for _ in range(5):
            assert _login(auth_client, password="wrong").status_code == 200
        resp = _login(auth_client)
        assert resp.status_code == 429
        assert "Too many failed attempts" in resp.get_data(as_text=True)

    def test_other_ip_not_affected(self, auth_client):
        for _ in range(5):
            _login(auth_client, password="wrong", ip="10.0.0.1")
        assert _login(auth_client, ip="10.0.0.2").status_code == 302

    def test_success_resets_counter(self, auth_client):
        for _ in range(4):
            _login(auth_client, password="wrong")
        assert _login(auth_client).status_code == 302
        auth_client.post("/logout")
        for _ in range(4):
            assert _login(auth_client, password="wrong").status_code == 200

    def test_per_ip_cap_across_usernames(self, auth_client):
        for i in range(20):
            _login(auth_client, user=f"user{i}", password="wrong")
        assert _login(auth_client).status_code == 429

    def test_window_expiry(self):
        for _ in range(5):
            wine_app.record_login_failure("10.9.9.9", "x", now=1000.0)
        assert wine_app.login_throttled("10.9.9.9", "x", now=1001.0)
        assert not wine_app.login_throttled("10.9.9.9", "x", now=1000.0 + wine_app.LOGIN_WINDOW_SECONDS + 1)


# ── Proxy header trust ───────────────────────────────────────────────────────

class TestProxyHeaders:
    def test_spoofed_forwarded_for_ignored_without_trust_proxy(self, auth_client):
        assert wine_app.TRUST_PROXY is False
        for i in range(5):
            auth_client.post("/login", data={"username": "diego", "password": "wrong"},
                             headers={"X-Forwarded-For": f"198.51.100.{i}"},
                             environ_base={"REMOTE_ADDR": "10.0.0.1"})
        resp = auth_client.post("/login", data={"username": "diego", "password": PW},
                                headers={"X-Forwarded-For": "198.51.100.77"},
                                environ_base={"REMOTE_ADDR": "10.0.0.1"})
        assert resp.status_code == 429

    def test_proxyfix_keys_throttle_on_last_hop(self, auth_client, app, monkeypatch):
        # Same wrapper the app installs when TRUST_PROXY=1.
        monkeypatch.setattr(app, "wsgi_app", ProxyFix(app.wsgi_app, x_for=1, x_proto=1))
        c = app.test_client()

        def attempt(xff, password):
            return c.post("/login", data={"username": "diego", "password": password},
                          headers={"X-Forwarded-For": xff}, environ_base={"REMOTE_ADDR": "127.0.0.1"})

        # A client-prepended value is ignored: only the last hop (set by nginx) counts.
        for i in range(5):
            attempt(f"198.51.100.{i}, 203.0.113.9", "wrong")
        assert attempt("1.1.1.1, 203.0.113.9", PW).status_code == 429
        assert attempt("203.0.113.10", PW).status_code == 302

    def test_ingress_header_ignored_when_untrusted(self, auth_client, monkeypatch):
        monkeypatch.setattr(wine_app, "TRUST_INGRESS_HEADER", False)
        resp = auth_client.post("/login", data={"username": "diego", "password": PW},
                                headers={"X-Ingress-Path": "https://evil.example"})
        assert resp.status_code == 302
        assert "evil" not in resp.headers["Location"]

    def test_invalid_ingress_value_ignored_even_when_trusted(self, auth_client, monkeypatch):
        monkeypatch.setattr(wine_app, "TRUST_INGRESS_HEADER", True)
        resp = auth_client.post("/login", data={"username": "diego", "password": PW},
                                headers={"X-Ingress-Path": "//evil.example"})
        assert "evil" not in resp.headers["Location"]

    def test_valid_ingress_used_when_trusted(self, auth_client, monkeypatch):
        monkeypatch.setattr(wine_app, "TRUST_INGRESS_HEADER", True)
        resp = auth_client.post("/login", data={"username": "diego", "password": PW},
                                headers={"X-Ingress-Path": "/api/hassio_ingress/abc_DEF-123"})
        assert resp.headers["Location"].endswith("/api/hassio_ingress/abc_DEF-123/")


# ── Uploads ──────────────────────────────────────────────────────────────────

class TestUploadAccess:
    @pytest.fixture
    def photo(self):
        import os
        name = "0123456789abcdef0123456789abcdef.jpg"
        with open(os.path.join(wine_app.UPLOAD_DIR, name), "wb") as f:
            f.write(b"\xff\xd8\xff\xe0fakejpeg")
        return name

    def test_anonymous_blocked_when_required(self, auth_client, photo, monkeypatch):
        monkeypatch.setattr(wine_app, "UPLOADS_REQUIRE_AUTH", True)
        resp = auth_client.get(f"/uploads/{photo}")
        assert resp.status_code == 302
        assert "/login" in resp.headers["Location"]

    def test_logged_in_allowed_with_private_cache(self, auth_client, photo, monkeypatch):
        monkeypatch.setattr(wine_app, "UPLOADS_REQUIRE_AUTH", True)
        _login(auth_client)
        resp = auth_client.get(f"/uploads/{photo}")
        assert resp.status_code == 200
        assert resp.headers["Cache-Control"].startswith("private")

    def test_upstream_behaviour_when_not_required(self, auth_client, photo, monkeypatch):
        monkeypatch.setattr(wine_app, "UPLOADS_REQUIRE_AUTH", False)
        assert auth_client.get(f"/uploads/{photo}").status_code == 200

    def test_traversal_still_blocked(self, auth_client, monkeypatch):
        monkeypatch.setattr(wine_app, "UPLOADS_REQUIRE_AUTH", True)
        _login(auth_client)
        assert auth_client.get("/uploads/..%2Fwine.db").status_code == 404


# ── Locked AI settings ───────────────────────────────────────────────────────

class TestLockedAiSettings:
    def test_save_rejected_when_locked(self, client, monkeypatch):
        monkeypatch.setattr(wine_app, "LOCK_AI_SETTINGS", True)
        resp = client.post("/api/ai-settings", json={"anthropic_api_key": "sk-ant-test"})
        assert resp.status_code == 403
        assert resp.get_json()["error"] == "ai_settings_locked"

    def test_db_values_ignored_when_locked(self, client, db, monkeypatch):
        db.execute("INSERT INTO app_settings (key, value) VALUES ('anthropic_api_key', 'from-db')")
        db.execute("INSERT INTO app_settings (key, value) VALUES ('ai_provider', 'openai')")
        db.commit()
        monkeypatch.setenv("ANTHROPIC_API_KEY", "from-env")
        monkeypatch.setenv("AI_PROVIDER", "anthropic")
        monkeypatch.setattr(wine_app, "LOCK_AI_SETTINGS", False)
        assert wine_app.load_options()["anthropic_api_key"] == "from-db"
        monkeypatch.setattr(wine_app, "LOCK_AI_SETTINGS", True)
        opts = wine_app.load_options()
        assert opts["anthropic_api_key"] == "from-env"
        assert opts["ai_provider"] == "anthropic"

    def test_get_reports_locked(self, client, monkeypatch):
        monkeypatch.setattr(wine_app, "LOCK_AI_SETTINGS", True)
        assert client.get("/api/ai-settings").get_json()["locked"] is True
