from dataclasses import dataclass


@dataclass(frozen=True)
class Song:
    title: str
    album: str
    year: int
    energy: int
    moods: tuple[str, ...]
    situations: tuple[str, ...]
    styles: tuple[str, ...]


WOODZ_SONGS: tuple[Song, ...] = (
    Song(
        title="Love Me Harder",
        album="Equal",
        year=2020,
        energy=4,
        moods=("sultry", "confident", "dark-pop"),
        situations=("night", "workout", "focus"),
        styles=("groovy", "performance", "hooky"),
    ),
    Song(
        title="Accident",
        album="Equal",
        year=2020,
        energy=3,
        moods=("emotional", "intense", "yearning"),
        situations=("night", "alone", "reflect"),
        styles=("dramatic", "vocal-heavy", "rock-influenced"),
    ),
    Song(
        title="BUMP BUMP",
        album="Woops!",
        year=2020,
        energy=5,
        moods=("bright", "playful", "energetic"),
        situations=("drive", "party", "daytime"),
        styles=("band-sound", "youthful", "anthemic"),
    ),
    Song(
        title="Feel Like",
        album="Set",
        year=2021,
        energy=4,
        moods=("smooth", "sultry", "confident"),
        situations=("night", "drive", "focus"),
        styles=("r-and-b", "groovy", "sleek"),
    ),
    Song(
        title="Kiss of Fire",
        album="Only Lovers Left",
        year=2021,
        energy=4,
        moods=("dramatic", "passionate", "cinematic"),
        situations=("night", "performance", "focus"),
        styles=("latin-pop", "theatrical", "rhythmic"),
    ),
    Song(
        title="Waiting",
        album="Only Lovers Left",
        year=2021,
        energy=3,
        moods=("emotional", "melancholic", "yearning"),
        situations=("rainy-day", "alone", "reflect"),
        styles=("pop-rock", "anthemic", "vocal-heavy"),
    ),
    Song(
        title="I Hate You",
        album="Colorful Trauma",
        year=2022,
        energy=4,
        moods=("rebellious", "bright", "cathartic"),
        situations=("drive", "breakup", "daytime"),
        styles=("pop-punk", "band-sound", "sing-along"),
    ),
    Song(
        title="Abyss",
        album="Oo-Li",
        year=2023,
        energy=2,
        moods=("moody", "lonely", "atmospheric"),
        situations=("night", "alone", "reflect"),
        styles=("alt-r-and-b", "minimal", "immersive"),
    ),
    Song(
        title="Journey",
        album="Oo-Li",
        year=2023,
        energy=2,
        moods=("warm", "hopeful", "calm"),
        situations=("walk", "sunset", "relax"),
        styles=("acoustic", "gentle", "comforting"),
    ),
    Song(
        title="Drowning",
        album="Oo-Li",
        year=2023,
        energy=5,
        moods=("emotional", "explosive", "intense"),
        situations=("live-stage", "catharsis", "night"),
        styles=("rock", "vocal-heavy", "anthemic"),
    ),
)
