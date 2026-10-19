"""Regression tests: Anthropic responses with thinking blocks, and no
exception text leaking to clients (production bug, 2026-10-18)."""
import io
import json
import os
from unittest.mock import MagicMock, patch

import pytest
from anthropic.types import Message, TextBlock, ThinkingBlock, Usage

import app as wine_app

APP_DIR = os.path.join(os.path.dirname(__file__), "..", "app")
LEAK = "internal detail sk-ant-api03-LEAKCHECK"
OPTS = {
    "ai_provider": "anthropic",
    "anthropic_api_key": "test-not-a-real-key",
    "anthropic_model": "claude-sonnet-5-5",
}


def _message(blocks, stop_reason="end_turn"):
    return Message(
        id="msg_test", type="message", role="assistant", model="claude-sonnet-5-5",
        content=blocks, stop_reason=stop_reason, stop_sequence=None,
        usage=Usage(input_tokens=10, output_tokens=20),
    )


def _thinking():
    return ThinkingBlock(type="thinking", thinking="Let me think about this wine.", signature="sig")


def _text(t):
    return TextBlock(type="text", text=t)


def _fake_anthropic(message):
    """Patch anthropic.Anthropic so client.messages.create returns `message`."""
    client = MagicMock()
    client.messages.create.return_value = message
    return patch("anthropic.Anthropic", return_value=client), client


@pytest.fixture
def anthropic_opts(monkeypatch):
    opts = {**wine_app.HA_OPTIONS, **OPTS}
    monkeypatch.setattr(wine_app, "load_options", lambda: opts)
    return opts


class TestAnthropicText:
    def test_thinking_then_text(self):
        assert wine_app._anthropic_text(_message([_thinking(), _text("Hello")])) == "Hello"

    def test_multiple_text_blocks_joined(self):
        msg = _message([_text("Part one. "), _thinking(), _text("Part two.")])
        assert wine_app._anthropic_text(msg) == "Part one. Part two."

    def test_thinking_only_raises_with_stop_reason(self):
        with pytest.raises(wine_app.AIEmptyResponseError, match="stop_reason=max_tokens"):
            wine_app._anthropic_text(_message([_thinking()], stop_reason="max_tokens"))

    def test_empty_content_raises(self):
        with pytest.raises(wine_app.AIEmptyResponseError):
            wine_app._anthropic_text(_message([]))

    def test_whitespace_only_text_raises(self):
        with pytest.raises(wine_app.AIEmptyResponseError):
            wine_app._anthropic_text(_message([_thinking(), _text("  \n")]))


class TestCallSites:
    def test_label_scan_call_handles_thinking(self):
        p, client = _fake_anthropic(_message([_thinking(), _text('{"name": "X"}')]))
        with p:
            out = wine_app._call_anthropic(None, None, "prompt", OPTS)
        assert out == '{"name": "X"}'
        assert client.messages.create.call_args.kwargs["max_tokens"] >= 4096

    def test_chat_call_handles_thinking(self):
        p, client = _fake_anthropic(_message([_thinking(), _text("A Barolo.")]))
        with p:
            out = wine_app._call_chat_anthropic([{"role": "user", "content": "hi"}], "sys", OPTS)
        assert out == "A Barolo."
        assert client.messages.create.call_args.kwargs["max_tokens"] >= 4096

    def test_no_direct_content_index_left(self):
        with open(os.path.join(APP_DIR, "app.py"), encoding="utf-8") as fh:
            src = fh.read()
        assert "content[0].text" not in src


class TestChatRoute:
    def _post(self, client):
        return client.post("/api/chat", data=json.dumps({"message": "Recommend a red", "save": False}),
                           content_type="application/json")

    def test_chat_with_thinking_block_returns_200(self, client, anthropic_opts):
        p, _ = _fake_anthropic(_message([_thinking(), _text("Try a Nebbiolo.")]))
        with p:
            resp = self._post(client)
        data = resp.get_json()
        assert resp.status_code == 200, data
        assert data["ok"] is True
        assert "Nebbiolo" in data["response"]

    def test_chat_thinking_only_is_clear_generic_error(self, client, anthropic_opts):
        p, _ = _fake_anthropic(_message([_thinking()], stop_reason="max_tokens"))
        with p:
            resp = self._post(client)
        data = resp.get_json()
        assert resp.status_code == 500
        assert data == {"ok": False, "error": "empty_response"}

    def test_chat_exception_text_not_returned(self, client, anthropic_opts):
        with patch("app._call_chat", side_effect=RuntimeError(LEAK)):
            resp = self._post(client)
        body = resp.get_data(as_text=True)
        assert resp.status_code == 500
        assert resp.get_json()["error"] == "api_error"
        assert "sk-ant" not in body and "internal detail" not in body

    def test_chat_timeout_code(self, client, anthropic_opts):
        class APITimeoutError(Exception):
            pass
        with patch("app._call_chat", side_effect=APITimeoutError("x")):
            resp = self._post(client)
        assert resp.get_json()["error"] == "timeout"


class TestLabelScanRoute:
    def _post(self, client):
        img = (io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100), "label.png")
        return client.post("/api/analyze-wine", data={"image": img}, content_type="multipart/form-data")

    def test_scan_with_thinking_block_returns_fields(self, client, anthropic_opts):
        payload = json.dumps({"name": "Barolo", "wine_type": "Rotwein", "vintage": 2018})
        p, _ = _fake_anthropic(_message([_thinking(), _text(payload)]))
        with p:
            resp = self._post(client)
        data = resp.get_json()
        assert resp.status_code == 200, data
        assert data["fields"]["name"] == "Barolo"

    def test_scan_thinking_only_is_generic_error(self, client, anthropic_opts):
        p, _ = _fake_anthropic(_message([_thinking()], stop_reason="max_tokens"))
        with p:
            resp = self._post(client)
        data = resp.get_json()
        assert resp.status_code == 500
        assert data["error"] == "empty_response"
        assert "message" not in data
        assert "image_filename" in data

    def test_scan_exception_text_not_returned(self, client, anthropic_opts):
        with patch("app._call_anthropic", side_effect=RuntimeError(LEAK)):
            resp = self._post(client)
        body = resp.get_data(as_text=True)
        assert resp.get_json()["error"] == "api_error"
        assert "sk-ant" not in body and "internal detail" not in body


class TestOtherLeaks:
    def test_reanalyze_exception_text_not_returned(self, client, anthropic_opts):
        with patch("app._analyze_wine_from_context", side_effect=RuntimeError(LEAK)):
            resp = client.post("/api/reanalyze-wine", json={"wine_context": {"name": "X"}})
        body = resp.get_data(as_text=True)
        assert resp.status_code == 500
        assert "sk-ant" not in body and "internal detail" not in body

    def test_reanalyze_bad_json_is_parse_error(self, client, anthropic_opts):
        with patch("app._analyze_wine_from_context", side_effect=json.JSONDecodeError("bad", "x", 0)):
            resp = client.post("/api/reanalyze-wine", json={"wine_context": {"name": "X"}})
        assert resp.status_code == 500
        assert resp.get_json()["error"] == "parse_error"

    def test_reanalyze_other_value_error_is_generic(self, client, anthropic_opts):
        with patch("app._analyze_wine_from_context", side_effect=ValueError(LEAK)):
            resp = client.post("/api/reanalyze-wine", json={"wine_context": {"name": "X"}})
        body = resp.get_data(as_text=True)
        assert resp.status_code == 500
        assert "sk-ant" not in body

    def test_ai_settings_test_exception_text_not_returned(self, client, anthropic_opts):
        with patch("app._call_chat_anthropic", side_effect=RuntimeError(LEAK)):
            resp = client.post("/api/ai-settings/test")
        body = resp.get_data(as_text=True)
        assert resp.status_code in (403, 502)
        assert "sk-ant" not in body and "internal detail" not in body

    def test_ai_settings_models_exception_text_not_returned(self, client, anthropic_opts):
        with patch("app._list_provider_models", side_effect=RuntimeError(LEAK)):
            resp = client.get("/api/ai-settings/models?provider=anthropic")
        body = resp.get_data(as_text=True)
        assert resp.status_code in (403, 502)
        assert "sk-ant" not in body and "internal detail" not in body


class TestChatKeyboard:
    def _src(self, *parts):
        with open(os.path.join(APP_DIR, *parts), encoding="utf-8") as fh:
            return fh.read()

    def test_hosted_uses_visual_viewport_and_ha_hack_is_gated(self):
        src = self._src("templates", "chat.html")
        kb = src[src.index("Keyboard compensation"):]
        assert "visualViewport" in kb
        assert "innerHeight - vv.height - vv.offsetTop" in kb
        # The 320px estimate and the scroll clamp live only in the embedded branch
        embedded = kb[kb.index("if (embedded) {"):kb.index("var vv = window.visualViewport")]
        assert "KB_INSET_PX = 320" in embedded
        assert "scrollTo(0, 0)" in embedded
        hosted = kb[kb.index("var vv = window.visualViewport"):]
        assert "scrollTo" not in hosted and "320" not in hosted

    def test_no_bottom_transition_outside_embedded(self):
        css = self._src("static", "style.css")
        block = css[css.index("\n.chat-fullpage {"):]
        block = block[:block.index("}")]
        assert "transition" not in block
        assert "body.embedded .chat-fullpage" in css

    def test_chat_page_renders(self, client, anthropic_opts):
        resp = client.get("/chat")
        assert resp.status_code == 200
        html = resp.get_data(as_text=True)
        assert "window.visualViewport" in html
        assert 'class="chat-page"' in html  # not embedded without ingress
