from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.catalog import LOCAL_SONG_CATALOG
from backend.config import get_settings


def serialize_song(song) -> dict[str, object]:
    payload = song.model_dump()
    payload.pop("embedding", None)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed WOODZ songs into Supabase.")
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Delete all rows in public.songs before inserting the local catalog.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the payload instead of writing to Supabase.",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        print("SUPABASE_URL and SUPABASE_KEY are required.", file=sys.stderr)
        return 1

    songs = [serialize_song(song) for song in LOCAL_SONG_CATALOG]
    if args.dry_run:
        print(json.dumps({"count": len(songs), "songs": songs}, indent=2, ensure_ascii=False))
        return 0

    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_key)

    if args.truncate:
        client.table("songs").delete().neq("id", "").execute()

    response = client.table("songs").upsert(songs).execute()
    inserted = response.data or []
    print(f"Seeded {len(inserted)} songs into Supabase.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
