from woodz_recommender.engine import (
    RecommendationQuery,
    WOODZRecommender,
    format_recommendations,
)


def _prompt_list(label: str) -> list[str]:
    raw = input(f"{label} (쉼표로 구분, 비워두면 생략): ").strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _prompt_int(label: str, default: int) -> int:
    raw = input(f"{label} [{default}]: ").strip()
    if not raw:
        return default
    return int(raw)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Recommend WOODZ songs by mood and context.")
    parser.add_argument("--mood", action="append", default=[], help="Preferred mood tag")
    parser.add_argument("--situation", action="append", default=[], help="Preferred situation tag")
    parser.add_argument("--seed", help="A WOODZ song to use as the similarity anchor")
    parser.add_argument("--min-energy", type=int, default=1, help="Minimum energy level (1-5)")
    parser.add_argument("--max-energy", type=int, default=5, help="Maximum energy level (1-5)")
    parser.add_argument("--top-k", type=int, default=5, help="How many songs to recommend")
    parser.add_argument("--interactive", action="store_true", help="Run in interactive mode")
    args = parser.parse_args()

    if args.interactive or (not args.mood and not args.situation and not args.seed):
        print("WOODZ 추천 시스템")
        print("-" * 24)
        moods = _prompt_list("원하는 mood")
        situations = _prompt_list("원하는 situation")
        seed = input("기준이 될 곡명 (비워두면 생략): ").strip() or None
        min_energy = _prompt_int("최소 energy", 1)
        max_energy = _prompt_int("최대 energy", 5)
        top_k = _prompt_int("추천 개수", 5)
    else:
        moods = args.mood
        situations = args.situation
        seed = args.seed
        min_energy = args.min_energy
        max_energy = args.max_energy
        top_k = args.top_k

    query = RecommendationQuery(
        preferred_moods=moods,
        preferred_situations=situations,
        seed_song=seed,
        min_energy=min_energy,
        max_energy=max_energy,
        top_k=top_k,
    )

    recommender = WOODZRecommender()
    recommendations = recommender.recommend(query)
    print()
    print(format_recommendations(recommendations))


if __name__ == "__main__":
    main()
