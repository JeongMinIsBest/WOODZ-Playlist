from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.config import get_settings
from backend.embeddings import EmbeddingService
from backend.models import SongRecord


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate and upload song embeddings to Supabase.")
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Only process the first N songs. 0 means all songs.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the embedding payload metadata without writing to Supabase.",
    )
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Only embed rows where embedding is null.",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        print("SUPABASE_URL and SUPABASE_KEY are required.", file=sys.stderr)
        return 1
    if not settings.openai_api_key:
        print("OPENAI_API_KEY is required.", file=sys.stderr)
        return 1

    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_key)
    query = client.table("songs").select("*").order("release_year")
    if args.only_missing:
        query = query.is_("embedding", "null")

    response = query.execute()
    rows = response.data or []
    songs = [SongRecord.model_validate(row) for row in rows]
    if args.limit > 0:
        songs = songs[: args.limit]

    embedding_service = EmbeddingService(settings)
    updates: list[dict[str, object]] = []
    for song in songs:
      embedding = embedding_service.embed_text(song.embedding_text)
      if embedding is None:
          continue
      updates.append(
          {
              "id": song.id,
              "embedding": embedding,
          }
      )

    if args.dry_run:
        preview = {
            "count": len(updates),
            "song_ids": [item["id"] for item in updates],
            "embedding_length": len(updates[0]["embedding"]) if updates else 0,
        }
        print(json.dumps(preview, indent=2, ensure_ascii=False))
        return 0

    if not updates:
        print("No songs required embedding updates.")
        return 0

    result = client.table("songs").upsert(updates).execute()
    updated = result.data or []
    print(f"Uploaded embeddings for {len(updated)} songs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
