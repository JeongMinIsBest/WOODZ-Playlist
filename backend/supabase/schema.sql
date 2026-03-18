create extension if not exists vector;

create table if not exists public.songs (
    id text primary key,
    title text not null,
    album text not null,
    release_year integer not null,
    lyrics text,
    lyrics_summary text not null,
    mood_tags text[] not null default '{}',
    weather_tags text[] not null default '{}',
    time_tags text[] not null default '{}',
    emotion_tags text[] not null default '{}',
    lyrics_themes text[] not null default '{}',
    energy_score double precision not null,
    sentiment_score double precision not null,
    artwork_url text,
    youtube_music_url text,
    embedding vector(1536),
    created_at timestamptz not null default now()
);

create index if not exists songs_embedding_idx
on public.songs
using ivfflat (embedding vector_cosine_ops)
with (lists = 50);
