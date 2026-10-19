"""Tests for Cloudflare Access JWT validation at the origin."""
import time

import app as wine_app
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

TEAM = "unit-test.cloudflareaccess.com"
AUD = "unit-test-aud-tag"


def _key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


GOOD_KEY = _key()
OTHER_KEY = _key()


class _SigningKey:
    def __init__(self, key):
        self.key = key


class FakeJwks:
    """Stands in for PyJWKClient: returns GOOD_KEY's public half for kid 'good'."""

    def __init__(self):
        self.calls = 0

    def get_signing_key_from_jwt(self, token):
        self.calls += 1
        kid = jwt.get_unverified_header(token).get("kid")
        if kid != "good":
            raise jwt.PyJWKClientError("Unable to find a signing key that matches")
        return _SigningKey(GOOD_KEY.public_key())


def make_token(key=GOOD_KEY, kid="good", aud=AUD, iss=f"https://{TEAM}", exp_in=300,
               email="diego@clearnuvo.com", alg="RS256", drop=()):
    now = int(time.time())
    claims = {"aud": [aud], "iss": iss, "iat": now, "exp": now + exp_in, "email": email,
              "sub": "user-id", "type": "app"}
    for k in drop:
        claims.pop(k, None)
    return jwt.encode(claims, key, algorithm=alg, headers={"kid": kid})


@pytest.fixture
def cf_on(monkeypatch):
    fake = FakeJwks()
    monkeypatch.setattr(wine_app, "CF_ACCESS_ENABLED", True)
    monkeypatch.setattr(wine_app, "CF_ACCESS_TEAM_DOMAIN", TEAM)
    monkeypatch.setattr(wine_app, "CF_ACCESS_AUD", AUD)
    monkeypatch.setattr(wine_app, "CF_ACCESS_ALLOWED_EMAILS", set())
    monkeypatch.setattr(wine_app, "_cf_jwks", lambda: fake)
    return fake


def _get(client, token=None, path="/"):
    headers = {"Cf-Access-Jwt-Assertion": token} if token is not None else {}
    return client.get(path, headers=headers)


class TestCfAccess:
    def test_valid_token_passes(self, client, cf_on):
        assert _get(client, make_token()).status_code == 200

    def test_missing_header_denied(self, client, cf_on):
        resp = _get(client)
        assert resp.status_code == 403
        assert resp.get_data(as_text=True) == "Access denied"

    def test_api_denied_with_json(self, client, cf_on):
        resp = _get(client, path="/api/summary")
        assert resp.status_code == 403
        assert resp.get_json() == {"ok": False, "error": "access_denied"}

    def test_wrong_audience_denied(self, client, cf_on):
        assert _get(client, make_token(aud="someone-elses-app")).status_code == 403

    def test_wrong_issuer_denied(self, client, cf_on):
        assert _get(client, make_token(iss="https://evil.cloudflareaccess.com")).status_code == 403

    def test_expired_denied(self, client, cf_on):
        assert _get(client, make_token(exp_in=-120)).status_code == 403

    def test_within_leeway_passes(self, client, cf_on):
        assert _get(client, make_token(exp_in=-10)).status_code == 200

    def test_signed_by_other_key_denied(self, client, cf_on):
        assert _get(client, make_token(key=OTHER_KEY)).status_code == 403

    def test_unknown_kid_denied(self, client, cf_on):
        assert _get(client, make_token(kid="nope")).status_code == 403

    def test_alg_none_denied(self, client, cf_on):
        now = int(time.time())
        forged = jwt.encode({"aud": AUD, "iss": f"https://{TEAM}", "iat": now, "exp": now + 60},
                            key=None, algorithm="none", headers={"kid": "good"})
        assert _get(client, forged).status_code == 403

    def test_hs256_with_public_key_denied(self, client, cf_on):
        # Classic key-confusion attempt must not verify (only RS256 allowed).
        now = int(time.time())
        forged = jwt.encode({"aud": AUD, "iss": f"https://{TEAM}", "iat": now, "exp": now + 60},
                            "not-the-real-signing-key-but-32-bytes-long", algorithm="HS256", headers={"kid": "good"})
        assert _get(client, forged).status_code == 403

    @pytest.mark.parametrize("claim", ["exp", "iat"])
    def test_missing_required_claim_denied(self, client, cf_on, claim):
        assert _get(client, make_token(drop=(claim,))).status_code == 403

    def test_garbage_token_denied(self, client, cf_on):
        assert _get(client, "not.a.jwt").status_code == 403

    def test_healthz_exempt(self, client, cf_on):
        assert _get(client, path="/healthz").status_code == 200

    def test_static_not_exempt(self, client, cf_on):
        assert _get(client, path="/static/csrf.js").status_code == 403

    def test_runs_before_csrf(self, client, cf_on, app, monkeypatch):
        monkeypatch.setitem(app.config, "WTF_CSRF_ENABLED", True)
        resp = client.post("/api/prefs", json={})
        assert resp.status_code == 403  # Access first, not a 400 CSRF error
        assert wine_app.app.before_request_funcs[None][0] is wine_app.check_cf_access

    def test_email_allowlist(self, client, cf_on, monkeypatch):
        monkeypatch.setattr(wine_app, "CF_ACCESS_ALLOWED_EMAILS", {"diego@clearnuvo.com"})
        assert _get(client, make_token()).status_code == 200
        assert _get(client, make_token(email="intruder@example.com")).status_code == 403

    def test_jwks_outage_denies(self, client, cf_on, monkeypatch):
        class Down:
            def get_signing_key_from_jwt(self, token):
                raise jwt.PyJWKClientConnectionError("down")
        monkeypatch.setattr(wine_app, "_cf_jwks", lambda: Down())
        assert _get(client, make_token()).status_code == 403

    def test_token_not_logged(self, client, cf_on, caplog):
        tok = make_token(aud="wrong")
        with caplog.at_level("WARNING"):
            _get(client, tok)
        assert tok not in caplog.text
        assert "InvalidAudienceError" in caplog.text

    def test_disabled_when_unset(self, client, monkeypatch):
        monkeypatch.setattr(wine_app, "CF_ACCESS_ENABLED", False)
        assert _get(client).status_code == 200


class TestHelpers:
    @pytest.mark.parametrize("raw,expected", [
        ("empty-water-3d63.cloudflareaccess.com", "empty-water-3d63.cloudflareaccess.com"),
        ("https://empty-water-3d63.cloudflareaccess.com/", "empty-water-3d63.cloudflareaccess.com"),
        ("", ""),
        (None, ""),
    ])
    def test_normalize_team_domain(self, raw, expected):
        assert wine_app._normalize_team_domain(raw) == expected
