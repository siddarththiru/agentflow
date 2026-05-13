import pytest

from app.config import gemini


class DummyChatModel:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


def test_build_gemini_chat_model_raises_when_api_key_missing(monkeypatch) -> None:
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setattr(gemini, "ChatGoogleGenerativeAI", DummyChatModel)

    with pytest.raises(RuntimeError):
        gemini.build_gemini_chat_model(model_name="gemini-2.5-flash")


def test_build_gemini_chat_model_uses_normalized_name(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "nci-test-key")
    monkeypatch.setattr(gemini, "ChatGoogleGenerativeAI", DummyChatModel)

    model = gemini.build_gemini_chat_model(model_name="gemini-2.5-flash-latest", temperature=0.2)

    assert model.kwargs["model"] == "gemini-2.5-flash"
    assert model.kwargs["api_key"] == "nci-test-key"
    assert model.kwargs["temperature"] == 0.2


def test_get_agent_chat_model_falls_back_to_default(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "nci-test-key")
    monkeypatch.setattr(gemini, "ChatGoogleGenerativeAI", DummyChatModel)

    class Agent:
        model = "custom-model-not-gemini"

    model = gemini.get_agent_chat_model(Agent())

    assert model.kwargs["model"] == gemini.DEFAULT_GEMINI_MODEL


def test_get_guard_chat_model_same_as_agent(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_API_KEY", "nci-test-key")
    monkeypatch.setattr(gemini, "ChatGoogleGenerativeAI", DummyChatModel)

    class Agent:
        model = "gemini-2.5-flash"

    class Policy:
        intent_guard_model_mode = "same_as_agent"
        intent_guard_model = "gemini-2.5-flash"

    model = gemini.get_guard_chat_model(Agent(), Policy())

    assert model.kwargs["model"] == "gemini-2.5-flash"
