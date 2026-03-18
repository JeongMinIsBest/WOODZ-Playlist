from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    openai_embedding_model: str
    supabase_url: str | None
    supabase_key: str | None
    default_timezone: str
    allowed_origins: tuple[str, ...]


def get_settings() -> Settings:
    origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173",
    )
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_key=os.getenv("SUPABASE_KEY"),
        default_timezone=os.getenv("DEFAULT_TIMEZONE", "Asia/Seoul"),
        allowed_origins=tuple(origin.strip() for origin in origins.split(",") if origin.strip()),
    )
