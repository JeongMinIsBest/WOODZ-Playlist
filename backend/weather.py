from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from .config import Settings
from .models import RecommendationRequest, WeatherContext


WEATHER_CODE_LABELS = {
    0: "sunny",
    1: "sunny",
    2: "cloudy",
    3: "cloudy",
    45: "cloudy",
    48: "cloudy",
    51: "rainy",
    53: "rainy",
    55: "rainy",
    61: "rainy",
    63: "rainy",
    65: "rainy",
    71: "snowy",
    73: "snowy",
    75: "snowy",
    77: "snowy",
    80: "rainy",
    81: "rainy",
    82: "rainy",
    95: "stormy",
    96: "stormy",
    99: "stormy",
}


class WeatherService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def resolve(self, request: RecommendationRequest) -> WeatherContext:
        timestamp = request.current_time or datetime.now(ZoneInfo(self.settings.default_timezone))
        time_bucket = self._time_bucket(timestamp.hour)

        if request.latitude is not None and request.longitude is not None:
            return self._resolve_from_coordinates(request, time_bucket)

        weather = (request.weather or "cloudy").lower()
        tags = self._build_tags(weather, request.temperature, time_bucket)
        return WeatherContext(
            location_label=request.location_label or "manual input",
            weather=weather,
            temperature=request.temperature,
            weather_tags=tags,
            time_bucket=time_bucket,
            derived_mood=self._derived_mood(weather),
            source="manual",
        )

    def _resolve_from_coordinates(
        self, request: RecommendationRequest, time_bucket: str
    ) -> WeatherContext:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": request.latitude,
            "longitude": request.longitude,
            "current": "temperature_2m,weather_code",
        }

        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()

        current = payload["current"]
        weather = WEATHER_CODE_LABELS.get(current["weather_code"], "cloudy")
        temperature = float(current["temperature_2m"])
        return WeatherContext(
            location_label=request.location_label or "current location",
            weather=weather,
            temperature=temperature,
            weather_tags=self._build_tags(weather, temperature, time_bucket),
            time_bucket=time_bucket,
            derived_mood=self._derived_mood(weather),
            source="open-meteo",
        )

    def _build_tags(self, weather: str, temperature: float | None, time_bucket: str) -> list[str]:
        tags = {weather, time_bucket}
        if temperature is not None:
            if temperature <= 5:
                tags.add("cold")
            elif temperature >= 27:
                tags.add("hot")
            else:
                tags.add("mild")
        return sorted(tags)

    def _derived_mood(self, weather: str) -> str:
        mapping = {
            "sunny": "bright",
            "cloudy": "calm",
            "rainy": "melancholic",
            "snowy": "emotional",
            "stormy": "intense",
        }
        return mapping.get(weather, "calm")

    def _time_bucket(self, hour: int) -> str:
        if hour < 6:
            return "night"
        if hour < 12:
            return "morning"
        if hour < 18:
            return "day"
        if hour < 22:
            return "evening"
        return "night"
