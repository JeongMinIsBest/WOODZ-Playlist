import unittest

from backend.config import Settings
from backend.embeddings import EmbeddingService
from backend.models import RecommendationRequest
from backend.recommendation import RecommendationService
from backend.repository import LocalSongRepository
from backend.weather import WeatherService


class RecommendationServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        settings = Settings(
            openai_api_key=None,
            openai_embedding_model="text-embedding-3-small",
            supabase_url=None,
            supabase_key=None,
            default_timezone="Asia/Seoul",
            allowed_origins=("http://localhost:3000",),
        )
        self.service = RecommendationService(
            repository=LocalSongRepository(),
            weather_service=WeatherService(settings),
            embedding_service=EmbeddingService(settings),
            settings=settings,
        )

    def test_rainy_lonely_context_prefers_waiting_like_songs(self) -> None:
        response = self.service.recommend(
            RecommendationRequest(
                weather="rainy",
                temperature=11,
                user_mood="lonely",
                user_text="비 오는 밤이라 기다리는 마음이 들어요",
                top_k=3,
            )
        )
        titles = [item.song_title for item in response.recommendations]
        self.assertIn("Waiting", titles)

    def test_recommendations_include_breakdown(self) -> None:
        response = self.service.recommend(
            RecommendationRequest(weather="sunny", temperature=24, user_mood="calm", top_k=1)
        )
        item = response.recommendations[0]
        self.assertGreaterEqual(item.breakdown.final_score, 0)
        self.assertTrue(item.reason)


if __name__ == "__main__":
    unittest.main()
