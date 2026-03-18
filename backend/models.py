from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SongRecord(BaseModel):
    id: str
    title: str
    album: str
    release_year: int
    lyrics: str | None = None
    lyrics_summary: str
    mood_tags: list[str] = Field(default_factory=list)
    weather_tags: list[str] = Field(default_factory=list)
    time_tags: list[str] = Field(default_factory=list)
    emotion_tags: list[str] = Field(default_factory=list)
    lyrics_themes: list[str] = Field(default_factory=list)
    energy_score: float
    sentiment_score: float
    artwork_url: str | None = None
    youtube_music_url: str | None = None
    embedding: list[float] | None = None

    @property
    def embedding_text(self) -> str:
        return " ".join(
            [
                self.title,
                self.album,
                self.lyrics_summary,
                " ".join(self.lyrics_themes),
                " ".join(self.mood_tags),
                " ".join(self.emotion_tags),
                " ".join(self.weather_tags),
                " ".join(self.time_tags),
            ]
        )


class RecommendationRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    location_label: str | None = None
    weather: str | None = None
    temperature: float | None = None
    user_mood: str = "nostalgic"
    user_text: str = ""
    current_time: datetime | None = None
    top_k: int = 5


class WeatherContext(BaseModel):
    location_label: str
    weather: str
    temperature: float | None = None
    weather_tags: list[str] = Field(default_factory=list)
    time_bucket: str
    derived_mood: str
    source: str


class ScoreBreakdown(BaseModel):
    weather_score: float
    mood_score: float
    time_score: float
    lyrics_similarity: float
    final_score: float


class RecommendationItem(BaseModel):
    song_title: str
    album: str
    score: float
    reason: str
    lyrics_summary: str
    lyrics_themes: list[str]
    artwork_url: str | None = None
    youtube_music_url: str | None = None
    breakdown: ScoreBreakdown


class RecommendationResponse(BaseModel):
    playlist_title: str
    weather_context: WeatherContext
    recommendations: list[RecommendationItem]
