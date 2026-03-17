from __future__ import annotations

from dataclasses import dataclass

from .data import Song, WOODZ_SONGS


@dataclass(frozen=True)
class RecommendationQuery:
    preferred_moods: list[str]
    preferred_situations: list[str]
    seed_song: str | None = None
    min_energy: int = 1
    max_energy: int = 5
    top_k: int = 5


@dataclass(frozen=True)
class RecommendationResult:
    song: Song
    score: float
    reasons: tuple[str, ...]


class WOODZRecommender:
    def __init__(self, songs: tuple[Song, ...] = WOODZ_SONGS) -> None:
        self.songs = songs
        self.song_index = {song.title.lower(): song for song in songs}

    def recommend(self, query: RecommendationQuery) -> list[RecommendationResult]:
        self._validate_query(query)
        seed = self.song_index.get(query.seed_song.lower()) if query.seed_song else None

        candidates: list[RecommendationResult] = []
        for song in self.songs:
            if seed and song.title.lower() == seed.title.lower():
                continue
            if not query.min_energy <= song.energy <= query.max_energy:
                continue

            score, reasons = self._score_song(song, query, seed)
            if score > 0:
                candidates.append(RecommendationResult(song=song, score=score, reasons=tuple(reasons)))

        candidates.sort(key=lambda item: (-item.score, item.song.year, item.song.title))
        return candidates[: query.top_k]

    def _validate_query(self, query: RecommendationQuery) -> None:
        if not 1 <= query.min_energy <= 5 or not 1 <= query.max_energy <= 5:
            raise ValueError("Energy range must stay between 1 and 5.")
        if query.min_energy > query.max_energy:
            raise ValueError("min_energy cannot be larger than max_energy.")
        if query.seed_song and query.seed_song.lower() not in self.song_index:
            raise ValueError(f"Unknown seed song: {query.seed_song}")

    def _score_song(
        self, song: Song, query: RecommendationQuery, seed: Song | None
    ) -> tuple[float, list[str]]:
        score = 1.0
        reasons: list[str] = []

        mood_matches = _overlap(song.moods, query.preferred_moods)
        if mood_matches:
            score += 2.2 * len(mood_matches)
            reasons.append(f"mood match: {', '.join(mood_matches)}")

        situation_matches = _overlap(song.situations, query.preferred_situations)
        if situation_matches:
            score += 1.8 * len(situation_matches)
            reasons.append(f"situation match: {', '.join(situation_matches)}")

        midpoint = (query.min_energy + query.max_energy) / 2
        energy_gap = abs(song.energy - midpoint)
        score += max(0, 2 - (0.6 * energy_gap))
        reasons.append(f"energy {song.energy}/5")

        if seed:
            shared_moods = _overlap(song.moods, seed.moods)
            shared_styles = _overlap(song.styles, seed.styles)
            if shared_moods:
                score += 1.7 * len(shared_moods)
                reasons.append(f"similar mood to {seed.title}: {', '.join(shared_moods)}")
            if shared_styles:
                score += 1.4 * len(shared_styles)
                reasons.append(f"similar style to {seed.title}: {', '.join(shared_styles)}")

        if not query.preferred_moods and not query.preferred_situations and not seed:
            score += 0.5
            reasons.append("general WOODZ starter pick")

        return score, reasons


def _overlap(source: tuple[str, ...], target: tuple[str, ...] | list[str]) -> list[str]:
    target_set = {item.lower() for item in target}
    return [item for item in source if item.lower() in target_set]


def format_recommendations(results: list[RecommendationResult]) -> str:
    if not results:
        return "조건에 맞는 추천 결과가 없습니다. mood/situation/energy 범위를 조금 넓혀보세요."

    lines = ["추천 결과"]
    for index, result in enumerate(results, start=1):
        song = result.song
        lines.append(
            f"{index}. {song.title} ({song.album}, {song.year}) - score {result.score:.1f}"
        )
        lines.append(f"   moods: {', '.join(song.moods)}")
        lines.append(f"   situations: {', '.join(song.situations)}")
        lines.append(f"   why: {' | '.join(result.reasons)}")
    return "\n".join(lines)
