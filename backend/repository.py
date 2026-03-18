from __future__ import annotations

from typing import Protocol

from .catalog import LOCAL_SONG_CATALOG
from .config import Settings
from .models import SongRecord


class SongRepository(Protocol):
    def list_songs(self) -> list[SongRecord]:
        ...


class LocalSongRepository:
    def list_songs(self) -> list[SongRecord]:
        return list(LOCAL_SONG_CATALOG)


class SupabaseSongRepository:
    def __init__(self, url: str, key: str) -> None:
        from supabase import Client, create_client

        self.client: Client = create_client(url, key)

    def list_songs(self) -> list[SongRecord]:
        response = self.client.table("songs").select("*").execute()
        rows = response.data or []
        return [SongRecord.model_validate(row) for row in rows]


def build_song_repository(settings: Settings) -> SongRepository:
    if settings.supabase_url and settings.supabase_key:
        try:
            return SupabaseSongRepository(settings.supabase_url, settings.supabase_key)
        except Exception:
            return LocalSongRepository()
    return LocalSongRepository()
