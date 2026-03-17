import unittest

from woodz_recommender.engine import RecommendationQuery, WOODZRecommender


class WOODZRecommenderTest(unittest.TestCase):
    def setUp(self) -> None:
        self.recommender = WOODZRecommender()

    def test_returns_emotional_recommendations(self) -> None:
        results = self.recommender.recommend(
            RecommendationQuery(
                preferred_moods=["emotional"],
                preferred_situations=["night"],
                top_k=3,
            )
        )
        self.assertTrue(results)
        titles = [item.song.title for item in results]
        self.assertIn("Drowning", titles)
        self.assertIn("Accident", titles)

    def test_seed_song_is_excluded_from_results(self) -> None:
        results = self.recommender.recommend(
            RecommendationQuery(
                preferred_moods=[],
                preferred_situations=[],
                seed_song="Waiting",
                top_k=10,
            )
        )
        titles = [item.song.title for item in results]
        self.assertNotIn("Waiting", titles)

    def test_unknown_seed_raises_error(self) -> None:
        with self.assertRaises(ValueError):
            self.recommender.recommend(
                RecommendationQuery(
                    preferred_moods=[],
                    preferred_situations=[],
                    seed_song="Not a song",
                )
            )


if __name__ == "__main__":
    unittest.main()
