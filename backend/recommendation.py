from __future__ import annotations

from dataclasses import dataclass

from .config import Settings
from .embeddings import EmbeddingService
from .models import (
    RecommendationItem,
    RecommendationRequest,
    RecommendationResponse,
    ScoreBreakdown,
    SongRecord,
)
from .repository import SongRepository
from .weather import WeatherService


MOOD_KEYWORDS = {
    "calm": {"calm", "healing", "gentle", "soft", "warm"},
    "sad": {"sad", "heartbreak", "regret", "emotional", "longing"},
    "excited": {"energetic", "wild", "bold", "charged", "bright"},
    "nostalgic": {"nostalgic", "memory", "farewell", "wistful", "throwback"},
    "lonely": {"lonely", "alone", "waiting", "distance", "empty"},
}


@dataclass(frozen=True)
class RankedSong:
    song: SongRecord
    breakdown: ScoreBreakdown
    reason: str


class RecommendationService:
    def __init__(
        self,
        repository: SongRepository,
        weather_service: WeatherService,
        embedding_service: EmbeddingService,
        settings: Settings,
    ) -> None:
        self.repository = repository
        self.weather_service = weather_service
        self.embedding_service = embedding_service
        self.settings = settings

    def recommend(self, request: RecommendationRequest) -> RecommendationResponse:
        weather_context = self.weather_service.resolve(request)
        songs = self.repository.list_songs()
        query_text = self._build_query_text(request, weather_context)
        query_embedding = self.embedding_service.embed_text(query_text)

        ranked = [
            self._rank_song(song, request, weather_context, query_embedding)
            for song in songs
        ]
        ranked.sort(key=lambda item: item.breakdown.final_score, reverse=True)

        top_items = ranked[: request.top_k]
        return RecommendationResponse(
            playlist_title="Today's WOODZ Playlist",
            weather_context=weather_context,
            recommendations=[
                RecommendationItem(
                    song_title=item.song.title,
                    album=item.song.album,
                    score=item.breakdown.final_score,
                    reason=item.reason,
                    lyrics_summary=item.song.lyrics_summary,
                    lyrics_themes=item.song.lyrics_themes,
                    artwork_url=item.song.artwork_url,
                    youtube_music_url=item.song.youtube_music_url,
                    breakdown=item.breakdown,
                )
                for item in top_items
            ],
        )

    def _rank_song(
        self,
        song: SongRecord,
        request: RecommendationRequest,
        weather_context,
        query_embedding: list[float] | None,
    ) -> RankedSong:
        weather_score = self._weather_score(song, weather_context.weather_tags, weather_context.derived_mood)
        mood_score = self._mood_score(song, request.user_mood)
        time_score = 1.0 if weather_context.time_bucket in song.time_tags else 0.25
        lyrics_similarity = self._lyrics_similarity(song, request.user_mood, request.user_text, query_embedding)

        final_score = round(
            0.35 * weather_score
            + 0.25 * mood_score
            + 0.20 * time_score
            + 0.20 * lyrics_similarity,
            3,
        )
        breakdown = ScoreBreakdown(
            weather_score=round(weather_score, 3),
            mood_score=round(mood_score, 3),
            time_score=round(time_score, 3),
            lyrics_similarity=round(lyrics_similarity, 3),
            final_score=final_score,
        )
        reason = self._build_reason(song, request.user_mood, weather_context, breakdown)
        return RankedSong(song=song, breakdown=breakdown, reason=reason)

    def _build_query_text(self, request: RecommendationRequest, weather_context) -> str:
        parts = [
            f"weather: {weather_context.weather}",
            f"time: {weather_context.time_bucket}",
            f"user mood: {request.user_mood}",
        ]
        if request.user_text:
            parts.append(f"user text: {request.user_text}")
        return " | ".join(parts)

    def _weather_score(self, song: SongRecord, weather_tags: list[str], derived_mood: str) -> float:
        matches = len(set(song.weather_tags).intersection(weather_tags))
        mood_match = 0.35 if derived_mood in song.mood_tags else 0.0
        return min(1.0, matches / 3 + mood_match)

    def _mood_score(self, song: SongRecord, user_mood: str) -> float:
        direct_match = 0.75 if user_mood in song.emotion_tags else 0.0
        keyword_match = 0.25 if MOOD_KEYWORDS.get(user_mood, set()).intersection(song.mood_tags) else 0.0
        return min(1.0, direct_match + keyword_match)

    def _lyrics_similarity(
        self,
        song: SongRecord,
        user_mood: str,
        user_text: str,
        query_embedding: list[float] | None,
    ) -> float:
        song_embedding = song.embedding or self.embedding_service.embed_text(song.embedding_text)
        embedding_similarity = self.embedding_service.cosine_similarity(query_embedding, song_embedding)
        if embedding_similarity is not None:
            return max(0.0, min(1.0, (embedding_similarity + 1) / 2))

        tokens = self._tokenize(" ".join([user_mood, user_text]))
        if not tokens:
            tokens = self._tokenize(song.lyrics_summary)
        corpus = self._tokenize(" ".join(song.lyrics_themes + [song.lyrics_summary]))
        overlap = len(set(tokens).intersection(corpus))
        return min(1.0, overlap / max(3, len(set(tokens))))

    def _build_reason(self, song: SongRecord, user_mood: str, weather_context, breakdown: ScoreBreakdown) -> str:
        return (
            f"This song fits today's {weather_context.weather} weather and {weather_context.time_bucket} mood. "
            f"The lyrics center on {', '.join(song.lyrics_themes)}, which aligns with the user's {user_mood} emotion. "
            f"Score mix: weather {breakdown.weather_score}, mood {breakdown.mood_score}, "
            f"time {breakdown.time_score}, lyrics {breakdown.lyrics_similarity}."
        )

    def _tokenize(self, text: str) -> set[str]:
        return {
            token
            for token in "".join(char.lower() if char.isalnum() else " " for char in text).split()
            if token
        }
