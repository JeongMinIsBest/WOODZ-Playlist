from __future__ import annotations

import math

from openai import OpenAI

from .config import Settings


class EmbeddingService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        self.cache: dict[str, list[float]] = {}

    @property
    def enabled(self) -> bool:
        return self.client is not None

    def embed_text(self, text: str) -> list[float] | None:
        normalized = text.strip()
        if not normalized:
            return None
        if normalized in self.cache:
            return self.cache[normalized]
        if not self.client:
            return None

        response = self.client.embeddings.create(
            model=self.settings.openai_embedding_model,
            input=normalized,
            encoding_format="float",
        )
        embedding = response.data[0].embedding
        self.cache[normalized] = embedding
        return embedding

    def cosine_similarity(
        self, left: list[float] | None, right: list[float] | None
    ) -> float | None:
        if not left or not right or len(left) != len(right):
            return None

        dot = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(a * a for a in left))
        right_norm = math.sqrt(sum(b * b for b in right))
        if left_norm == 0 or right_norm == 0:
            return None
        return dot / (left_norm * right_norm)
