from pydantic import BaseModel


class SettingsIn(BaseModel):
    provider: str = "openai"  # openai | ollama | vllm
    base_url: str | None = None
    api_key: str | None = None  # blank/omitted => keep the stored key
    chat_models: str | None = None  # comma-separated
    default_model: str | None = None


class SettingsOut(BaseModel):
    provider: str = "openai"
    base_url: str | None = None
    chat_models: str | None = None
    default_model: str | None = None
    has_api_key: bool = False  # the raw key is never returned to the client
