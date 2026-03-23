from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .embeddings import EmbeddingService
from .models import RecommendationRequest
from .recommendation import RecommendationService
from .repository import build_song_repository
from .weather import WeatherService


settings = get_settings()
repository = build_song_repository(settings)
weather_service = WeatherService(settings)
embedding_service = EmbeddingService(settings)
recommendation_service = RecommendationService(
    repository=repository,
    weather_service=weather_service,
    embedding_service=embedding_service,
    settings=settings,
)

app = FastAPI(title="WOODZ Playlist API", version="0.1.0")

allowed_origins = list(settings.allowed_origins)
allow_all_origins = not allowed_origins or "*" in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/songs")
def list_songs() -> dict[str, object]:
    songs = repository.list_songs()
    return {"count": len(songs), "songs": songs}


@app.post("/api/v1/recommendations")
def create_recommendations(payload: RecommendationRequest):
    return recommendation_service.recommend(payload)
