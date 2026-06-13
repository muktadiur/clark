import os
from typing import List, Optional

from langchain_core.runnables.base import Runnable

from clark.base import BaseConversation
from clark.document import process_documents
from clark.gpt4all import GPT4AllConversation
from clark.hf import HFConversation
from clark.openai import OpenAIConversation

# Comma-separated chat models offered in the model picker, and the one
# checkmarked by default. Override both via .env (OPENAI_MODELS / OPENAI_DEFAULT_MODEL).
DEFAULT_OPENAI_MODELS = "gpt-4o,gpt-4o-mini,gpt-3.5-turbo"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"


def available_models(configured: Optional[str] = None) -> List[str]:
    """Models for the picker: per-user `configured` list if given, else env, else defaults."""
    raw = configured or os.getenv("OPENAI_MODELS", DEFAULT_OPENAI_MODELS)
    models = [model.strip() for model in raw.split(",") if model.strip()]
    return models or [DEFAULT_OPENAI_MODEL]


def default_model(
    configured: Optional[str] = None, preferred: Optional[str] = None
) -> str:
    models = available_models(configured)
    preferred = preferred or os.getenv("OPENAI_DEFAULT_MODEL", DEFAULT_OPENAI_MODEL)
    return preferred if preferred in models else models[0]


def resolve_model(model: Optional[str], configured: Optional[str] = None) -> str:
    """Accept a model only if it's in the allowed list; otherwise fall back."""
    models = available_models(configured)
    return model if model in models else default_model(configured)


def get_converstation(
    chat_model: Optional[str] = None,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    configured_models: Optional[str] = None,
) -> BaseConversation:
    if os.getenv("CONVERSATION_ENGINE") == "gpt4all":
        return GPT4AllConversation()

    if os.getenv("CONVERSATION_ENGINE") == "hf":
        return HFConversation()

    return OpenAIConversation(
        chat_model=resolve_model(chat_model, configured_models),
        base_url=base_url,
        api_key=api_key,
    )


def create_vectors() -> None:
    # Embeddings always use the OpenAI path (env OPENAI_API_KEY), independent of
    # the per-user chat provider, so the shared FAISS index stays consistent.
    texts: List[str] = process_documents()
    get_converstation().create_store(texts=texts)


def get_chain(
    chat_model: Optional[str] = None,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    configured_models: Optional[str] = None,
) -> Runnable:
    try:
        return get_converstation(
            chat_model, base_url, api_key, configured_models
        ).get_chain()
    except FileNotFoundError:
        create_vectors()
        return get_converstation(
            chat_model, base_url, api_key, configured_models
        ).get_chain()
