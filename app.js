import { SONG_CATALOG } from "./catalog.js";

const USER_MOOD_OPTIONS = ["calm", "sad", "excited", "nostalgic", "lonely"];
const API_BASE_CANDIDATES = [
  globalThis.WOODZ_API_BASE || null,
  `${window.location.origin}/api/v1`,
  "http://127.0.0.1:8000/api/v1",
  "http://localhost:8000/api/v1",
].filter(Boolean);
const MOOD_KEYWORD_MAP = {
  calm: ["calm", "soft", "gentle", "healing", "cozy", "warm"],
  sad: ["sad", "heartbreak", "emotional", "longing", "pain", "melancholy"],
  excited: ["excited", "energetic", "bright", "charged", "wild", "bold"],
  nostalgic: ["nostalgic", "memory", "farewell", "wistful", "throwback", "longing"],
  lonely: ["lonely", "alone", "empty", "waiting", "distance", "night"],
};
const LYRICS_THEME_HINTS = {
  WAITING: ["waiting", "longing", "loneliness"],
  Drowning: ["overwhelm", "emotion", "collapse"],
  Accident: ["regret", "turmoil", "self-reflection"],
  meaningless: ["emptiness", "distance", "loneliness"],
  Different: ["identity", "distance", "difference"],
  Chaser: ["pursuit", "obsession", "restlessness"],
  "Love Me Harder": ["desire", "confidence", "attraction"],
  Journey: ["movement", "hope", "healing"],
  ABYSS: ["depth", "loneliness", "introspection"],
  "I hate you": ["breakup", "defiance", "release"],
};

const state = {
  currentStep: 0,
  weather: {
    locationLabel: "위치 확인 중",
    summary: "브라우저 위치 권한을 허용하거나 도시를 검색해 주세요.",
    tags: ["loading"],
    temperature: null,
    code: null,
    isDay: true,
    timezone: "Asia/Seoul",
    currentTime: null,
  },
  filters: {
    search: "",
  },
  userContext: {
    mood: "nostalgic",
  },
  recommendationFeed: {
    source: "local",
    items: [],
    pending: false,
    error: null,
  },
  api: {
    baseUrl: null,
    checked: false,
    requestId: 0,
  },
  artworkCache: new Map(),
  artworkRequests: new Map(),
  albumArtworkCache: new Map(),
  albumArtworkRequests: new Map(),
};

const elements = {
  introScreen: document.querySelector("#intro-screen"),
  wizard: document.querySelector("#wizard"),
  progressChips: [...document.querySelectorAll(".progress-chip")],
  startButton: document.querySelector("#start-button"),
  locationStep: document.querySelector("#location-step"),
  moodStep: document.querySelector("#mood-step"),
  resultStep: document.querySelector("#result-step"),
  useLocationButton: document.querySelector("#use-location"),
  cityForm: document.querySelector("#city-form"),
  cityInput: document.querySelector("#city-input"),
  weatherStatus: document.querySelector("#weather-status"),
  weatherSummary: document.querySelector("#weather-summary"),
  weatherTags: document.querySelector("#weather-tags"),
  moodButtons: [...document.querySelectorAll(".mood-button")],
  backToLocationButton: document.querySelector("#back-to-location"),
  restartButton: document.querySelector("#restart-button"),
  recommendationCount: document.querySelector("#recommendation-count"),
  recommendationInsight: document.querySelector("#recommendation-insight"),
  recommendations: document.querySelector("#recommendations"),
};

function songLookupKey(value) {
  return normalizeText(value || "");
}

function deriveEmotionTags(song) {
  const tags = new Set();
  const moodSource = [...song.moods, ...song.categories, ...song.settings].join(" ").toLowerCase();

  if (/(warm|gentle|cozy|soft|healing|calm)/.test(moodSource)) tags.add("calm");
  if (/(heartbreak|emotional|yearning|regret|pain|sad|devastated)/.test(moodSource)) tags.add("sad");
  if (/(energetic|wild|bold|charged|playful|bright|aggressive)/.test(moodSource)) tags.add("excited");
  if (/(nostalgic|memory|wistful|farewell|throwback)/.test(moodSource)) tags.add("nostalgic");
  if (/(lonely|alone|waiting|distance|empty|night)/.test(moodSource)) tags.add("lonely");

  if (!tags.size) tags.add("calm");
  return [...tags];
}

function deriveTimeTags(song) {
  const tags = new Set();
  const source = [...song.settings, ...song.weatherTags].join(" ").toLowerCase();

  if (/(morning)/.test(source)) tags.add("morning");
  if (/(day|walk|drive|commute|travel)/.test(source)) tags.add("day");
  if (/(evening|sunset|home)/.test(source)) tags.add("evening");
  if (/(night|late|insomniac|rain)/.test(source)) tags.add("night");
  if (!tags.size) tags.add("day");
  return [...tags];
}

function deriveLyricsThemes(song) {
  if (LYRICS_THEME_HINTS[song.title]) {
    return LYRICS_THEME_HINTS[song.title];
  }

  return [
    song.moods[0] || "emotion",
    song.categories[0] || "identity",
    song.settings[0] || "moment",
  ];
}

function deriveSentimentScore(song) {
  const negative = /(heartbreak|lonely|regret|pain|dark|emptiness|overwhelm|distance)/;
  const positive = /(hopeful|bright|warm|healing|playful|comforting|resilient)/;
  const joined = [...song.moods, ...song.categories].join(" ").toLowerCase();
  if (negative.test(joined) && !positive.test(joined)) return -0.7;
  if (positive.test(joined) && !negative.test(joined)) return 0.6;
  return -0.1;
}

function deriveLyricsSummary(song) {
  const themes = deriveLyricsThemes(song);
  return `${song.title}는 ${themes.join(", ")}의 정서를 중심에 두고 있으며, ${song.moods[0] || "감성적"} 무드로 ${song.settings[0] || "지금 이 순간"}에 어울리는 곡입니다.`;
}

function enrichSong(song) {
  return {
    ...song,
    emotionTags: deriveEmotionTags(song),
    timeTags: deriveTimeTags(song),
    lyricsThemes: deriveLyricsThemes(song),
    lyricsSummary: deriveLyricsSummary(song),
    energyScore: Number((song.energy / 5).toFixed(2)),
    sentimentScore: deriveSentimentScore(song),
  };
}

const ENRICHED_SONGS = SONG_CATALOG.map(enrichSong);
const SONG_BY_TITLE = new Map(ENRICHED_SONGS.map((song) => [songLookupKey(song.title), song]));

function populateSelect(select, options, label) {
  select.innerHTML = "";
  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option;
    element.textContent = option === "all" ? `전체 ${label}` : option;
    select.appendChild(element);
  });
}

function weatherCodeToLabel(code) {
  if (code === 0) return "맑음";
  if ([1, 2].includes(code)) return "대체로 맑음";
  if (code === 3) return "흐림";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "폭풍";
  return "날씨 정보";
}

function deriveWeatherMood(tags) {
  if (tags.includes("stormy")) return "intense";
  if (tags.includes("snowy")) return "emotional";
  if (tags.includes("rainy")) return "melancholic";
  if (tags.includes("cloudy")) return "calm";
  return "bright";
}

function getCurrentTimeBucket() {
  const hour = state.weather.currentTime?.hour ?? new Date().getHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "day";
  if (hour < 22) return "evening";
  return "night";
}

function getCurrentTimeLabel() {
  return state.weather.currentTime?.label || new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toLocalTimeState(dateTimeText, timezone) {
  if (typeof dateTimeText === "string") {
    const [datePart = "", timePart = ""] = dateTimeText.split("T");
    const [hourText = "0", minuteText = "0"] = timePart.split(":");
    const hour = Number.parseInt(hourText, 10);
    const minute = Number.parseInt(minuteText, 10);

    if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
      return {
        label: `${hourText.padStart(2, "0")}:${minuteText.padStart(2, "0")}`,
        hour,
        minute,
        date: datePart,
        timezone: timezone || "Asia/Seoul",
      };
    }
  }

  const now = new Date();
  return {
    label: now.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(timezone ? { timeZone: timezone } : {}),
    }),
    hour: Number(
      now.toLocaleString("en-US", {
        hour: "2-digit",
        hour12: false,
        ...(timezone ? { timeZone: timezone } : {}),
      })
    ),
    minute: Number(
      now.toLocaleString("en-US", {
        minute: "2-digit",
        ...(timezone ? { timeZone: timezone } : {}),
      })
    ),
    date: now.toLocaleDateString("sv-SE", timezone ? { timeZone: timezone } : {}),
    timezone: timezone || "Asia/Seoul",
  };
}

function deriveWeatherTags(current) {
  const tags = [];

  if (current.weather_code === 0 || current.weather_code === 1) {
    tags.push("sunny");
  } else if ([2, 3, 45, 48].includes(current.weather_code)) {
    tags.push("cloudy");
  } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(current.weather_code)) {
    tags.push("rainy");
  } else if ([71, 73, 75, 77, 85, 86].includes(current.weather_code)) {
    tags.push("snowy");
  } else if ([95, 96, 99].includes(current.weather_code)) {
    tags.push("stormy");
  }

  if ((current.wind_speed_10m || 0) >= 20) {
    tags.push("windy");
  }

  if ((current.temperature_2m || 0) <= 5) {
    tags.push("cold");
  } else if ((current.temperature_2m || 0) >= 27) {
    tags.push("hot");
  } else {
    tags.push("mild");
  }

  tags.push(current.is_day ? "day" : "night");
  return [...new Set(tags)];
}

function toWeatherState(locationLabel, current, timezone) {
  const tags = deriveWeatherTags(current);
  const timeLabel = current.is_day ? "낮" : "밤";
  const currentTime = toLocalTimeState(current.time, timezone);
  const summary = `${locationLabel} · ${weatherCodeToLabel(current.weather_code)} · ${Math.round(
    current.temperature_2m
  )}°C · ${timeLabel}`;

  return {
    locationLabel,
    summary,
    tags,
    temperature: current.temperature_2m,
    code: current.weather_code,
    isDay: Boolean(current.is_day),
    timezone: timezone || "Asia/Seoul",
    currentTime,
  };
}

function energyBucket(energy) {
  if (energy <= 2) return "low";
  if (energy === 3) return "mid";
  return "high";
}

function scoreSong(song, weatherTags) {
  let score = 0;
  const reasons = [];

  const weatherMatches = song.weatherTags.filter((tag) => weatherTags.includes(tag));
  if (weatherMatches.length) {
    score += weatherMatches.length * 3;
    reasons.push(`날씨 태그 일치: ${weatherMatches.join(", ")}`);
  }

  if (weatherTags.includes("rainy") && song.moods.some((mood) => ["emotional", "heartbreak", "lonely", "deep"].includes(mood))) {
    score += 3;
    reasons.push("비 오는 날 감정선과 잘 맞음");
  }

  if (weatherTags.includes("sunny") && song.moods.some((mood) => ["bright", "hopeful", "playful", "warm"].includes(mood))) {
    score += 3;
    reasons.push("맑은 날 기분을 살리는 곡");
  }

  if (weatherTags.includes("snowy") && song.moods.some((mood) => ["cozy", "nostalgic", "tender", "warm"].includes(mood))) {
    score += 3;
    reasons.push("추운 날씨와 어울리는 온도감");
  }

  if (weatherTags.includes("stormy") && song.energy >= 4) {
    score += 2;
    reasons.push("거친 날씨에 어울리는 높은 에너지");
  }

  if (weatherTags.includes("night") && song.settings.includes("night")) {
    score += 2;
    reasons.push("지금 시간대와 분위기가 맞음");
  }

  return { score, reasons };
}

function tokenizePrompt(input) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function keywordOverlapScore(song, tokens) {
  if (!tokens.length) return 0;
  const corpus = [
    ...song.lyricsThemes,
    ...song.emotionTags,
    ...song.moods,
    song.lyricsSummary,
  ]
    .join(" ")
    .toLowerCase();

  const hits = tokens.filter((token) => corpus.includes(token));
  return Math.min(1, hits.length / Math.max(2, tokens.length));
}

function calculateComponentScores(song, context) {
  const weatherMatches = song.weatherTags.filter((tag) => context.weatherTags.includes(tag)).length;
  const weatherMoodMatch = song.moods.includes(context.weatherMood) ? 1 : 0;
  const weatherScore = Math.min(1, weatherMatches / 3 + weatherMoodMatch * 0.35);

  const moodMatch = song.emotionTags.includes(context.userMood) ? 1 : 0;
  const moodKeywordMatch = song.moods.some((mood) => MOOD_KEYWORD_MAP[context.userMood]?.includes(mood)) ? 0.4 : 0;
  const moodScore = Math.min(1, moodMatch * 0.7 + moodKeywordMatch);

  const timeScore = song.timeTags.includes(context.timeBucket) ? 1 : song.timeTags.includes("night") && context.timeBucket === "evening" ? 0.6 : 0.2;
  const lyricsSimilarity = Math.min(
    1,
    keywordOverlapScore(song, context.promptTokens) + (song.emotionTags.includes(context.userMood) ? 0.25 : 0)
  );

  return {
    weatherScore: Number(weatherScore.toFixed(2)),
    moodScore: Number(moodScore.toFixed(2)),
    timeScore: Number(timeScore.toFixed(2)),
    lyricsSimilarity: Number(lyricsSimilarity.toFixed(2)),
  };
}

function buildRecommendationReason(song, context, components) {
  const lines = [];
  lines.push(`오늘의 ${context.weatherLabel} 날씨와 ${context.timeLabel} 분위기에 ${song.title}의 정서가 잘 맞습니다.`);
  lines.push(`가사 핵심 테마는 ${song.lyricsThemes.join(", ")}이며, ${state.userContext.mood} 감정 입력과 연결됩니다.`);
  lines.push(
    `점수 구성: weather ${components.weatherScore}, mood ${components.moodScore}, time ${components.timeScore}, lyrics ${components.lyricsSimilarity}`
  );
  return lines.join(" ");
}

function showStep(step) {
  state.currentStep = step;
  elements.introScreen.classList.toggle("hidden", step !== 0);
  elements.wizard.classList.toggle("hidden", step === 0);
  elements.locationStep.classList.toggle("hidden", step !== 1);
  elements.moodStep.classList.toggle("hidden", step !== 2);
  elements.resultStep.classList.toggle("hidden", step !== 3);

  elements.progressChips.forEach((chip, index) => {
    chip.classList.toggle("is-active", index + 1 === step);
    chip.classList.toggle("is-complete", index + 1 < step);
  });
}

function applyFilters(song) {
  return true;
}

function recommendSongs() {
  const context = {
    weatherTags: state.weather.tags,
    weatherMood: deriveWeatherMood(state.weather.tags),
    weatherLabel: weatherCodeToLabel(state.weather.code),
    timeBucket: getCurrentTimeBucket(),
    timeLabel: getCurrentTimeLabel(),
    userMood: state.userContext.mood,
    promptTokens: [],
  };

  return ENRICHED_SONGS.filter(applyFilters)
    .map((song) => {
      const heuristic = scoreSong(song, state.weather.tags);
      const components = calculateComponentScores(song, context);
      const finalScore =
        0.35 * components.weatherScore +
        0.25 * components.moodScore +
        0.2 * components.timeScore +
        0.2 * components.lyricsSimilarity +
        heuristic.score * 0.015;
      return {
        song,
        score: Number(finalScore.toFixed(3)),
        reason: buildRecommendationReason(song, context, components),
        components,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.song.energy !== left.song.energy) {
        return right.song.energy - left.song.energy;
      }
      return left.song.title.localeCompare(right.song.title);
    });
}

function getActiveRecommendations() {
  if (state.recommendationFeed.source === "backend" && state.recommendationFeed.items.length) {
    return state.recommendationFeed.items;
  }
  return recommendSongs();
}

function buildRecommendationPayload() {
  return {
    location_label: state.weather.locationLabel,
    weather: deriveBackendWeatherName(state.weather.tags),
    temperature: state.weather.temperature,
    user_mood: state.userContext.mood,
    user_text: "",
    current_time: state.weather.currentTime?.date
      ? `${state.weather.currentTime.date}T${state.weather.currentTime.label}:00`
      : new Date().toISOString(),
    top_k: 5,
  };
}

function deriveBackendWeatherName(tags) {
  if (tags.includes("stormy")) return "stormy";
  if (tags.includes("snowy")) return "snowy";
  if (tags.includes("rainy")) return "rainy";
  if (tags.includes("sunny")) return "sunny";
  return "cloudy";
}

async function detectBackendBase() {
  if (state.api.baseUrl) {
    return state.api.baseUrl;
  }
  if (state.api.checked) {
    return null;
  }

  state.api.checked = true;
  for (const baseUrl of API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}/health`, { method: "GET" });
      if (response.ok) {
        state.api.baseUrl = baseUrl;
        return baseUrl;
      }
    } catch (_error) {
      continue;
    }
  }

  return null;
}

function mergeBackendSong(item) {
  const localSong = SONG_BY_TITLE.get(songLookupKey(item.song_title));
  if (localSong) {
    return {
      ...localSong,
      title: item.song_title,
      primaryRelease: item.album || localSong.primaryRelease,
      lyricsSummary: item.lyrics_summary || localSong.lyricsSummary,
      lyricsThemes: item.lyrics_themes?.length ? item.lyrics_themes : localSong.lyricsThemes,
      artworkUrl: item.artwork_url || localSong.artworkUrl || null,
      youtubeMusicUrl: item.youtube_music_url || buildYoutubeMusicUrl(localSong),
    };
  }

  return {
    id: songLookupKey(item.song_title),
    title: item.song_title,
    year: new Date().getFullYear(),
    primaryRelease: item.album || "Unknown Release",
    releaseType: "Single",
    releaseHistory: [item.album || "Unknown Release"],
    primaryCategory: "backend-result",
    categories: ["backend-result"],
    moods: [],
    weatherTags: [],
    settings: [],
    energy: 3,
    emotionTags: [],
    lyricsThemes: item.lyrics_themes || [],
    lyricsSummary: item.lyrics_summary || "",
    artworkUrl: item.artwork_url || null,
    youtubeMusicUrl: item.youtube_music_url || buildYoutubeMusicUrl({ title: item.song_title }),
  };
}

async function refreshRecommendations() {
  const requestId = ++state.api.requestId;
  state.recommendationFeed.pending = true;
  renderRecommendations();

  const baseUrl = await detectBackendBase();
  if (!baseUrl) {
    if (requestId !== state.api.requestId) return;
    state.recommendationFeed = {
      source: "local",
      items: [],
      pending: false,
      error: "백엔드 API를 찾지 못해 로컬 추천 엔진으로 표시 중입니다.",
    };
    renderRecommendations();
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/recommendations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRecommendationPayload()),
    });

    if (!response.ok) {
      throw new Error("backend recommendation request failed");
    }

    const payload = await response.json();
    if (requestId !== state.api.requestId) return;

    state.recommendationFeed = {
      source: "backend",
      pending: false,
      error: null,
      items: (payload.recommendations || []).map((item) => ({
        song: mergeBackendSong(item),
        score: item.score,
        reason: item.reason,
        components: {
          weatherScore: item.breakdown?.weather_score ?? 0,
          moodScore: item.breakdown?.mood_score ?? 0,
          timeScore: item.breakdown?.time_score ?? 0,
          lyricsSimilarity: item.breakdown?.lyrics_similarity ?? 0,
        },
      })),
    };
    renderRecommendations();
  } catch (_error) {
    if (requestId !== state.api.requestId) return;
    state.recommendationFeed = {
      source: "local",
      items: [],
      pending: false,
      error: "백엔드 호출에 실패해 로컬 추천 결과를 보여주고 있습니다.",
    };
    renderRecommendations();
  }
}

function createChip(text, tone = "default") {
  const chip = document.createElement("span");
  chip.className = `chip chip-${tone}`;
  chip.textContent = text;
  return chip;
}

function buildYoutubeMusicUrl(song) {
  const query = `${song.title} WOODZ`.trim();
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
}

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9가-힣]/g, "");
}

const MANUAL_ARTWORK_HINTS = {
  waiting: ["WAITING WOODZ", "ONLY LOVERS LEFT WOODZ"],
  "kiss of fire": ["Kiss of Fire WOODZ", "ONLY LOVERS LEFT WOODZ"],
  drowning: ["Drowning WOODZ", "OO-LI WOODZ"],
  abyss: ["ABYSS WOODZ", "OO-LI WOODZ"],
  amnesia: ["AMNESIA WOODZ"],
};

const RELEASE_ARTWORK_SEARCH_TERMS = {
  equal: ["EQUAL WOODZ", "Equal 조승연"],
  "only lovers left": ["ONLY LOVERS LEFT WOODZ", "Only Lovers Left 조승연"],
  "oo-li": ["OO-LI WOODZ", "Oo-Li 조승연"],
  "colorful trauma": ["COLORFUL TRAUMA WOODZ", "Colorful Trauma 조승연"],
  set: ["SET WOODZ", "SET 조승연"],
  different: ["DIFFERENT WOODZ", "Different 조승연"],
  meaningless: ["meaningless WOODZ", "meaningless 조승연"],
};

const RELEASE_ALIASES = {
  equal: ["equal"],
  "only lovers left": ["only lovers left"],
  "oo-li": ["ooli", "oo-li", "ooli", "ooli", "ooli"],
  "colorful trauma": ["colorful trauma"],
  set: ["set"],
  different: ["different"],
  meaningless: ["meaningless"],
};

function buildArtworkLookupUrl(term, entity = "song", limit = 10) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", term);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", entity);
  url.searchParams.set("country", "KR");
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

function hasExpectedArtist(result) {
  const artist = normalizeText(result.artistName);
  return (
    artist.includes("woodz") ||
    artist.includes("조승연") ||
    artist.includes("choseungyoun") ||
    artist.includes("cho승연")
  );
}

function releaseAliasMatches(song, result) {
  const release = normalizeText(song.primaryRelease);
  const collection = normalizeText(result.collectionName);
  const aliases = RELEASE_ALIASES[release] || [release];
  return aliases.some((alias) => collection === alias || collection.includes(alias) || alias.includes(collection));
}

function scoreArtworkResult(song, result, preferAlbum = false) {
  const title = normalizeText(song.title);
  const release = normalizeText(song.primaryRelease);
  const trackName = normalizeText(result.trackName);
  const collectionName = normalizeText(result.collectionName);
  const artistName = normalizeText(result.artistName);

  let score = 0;
  if (!hasExpectedArtist(result)) {
    return -100;
  }
  if (trackName === title) score += 7;
  if (trackName.includes(title) || title.includes(trackName)) score += 3;
  if (collectionName === release) score += 5;
  if (collectionName.includes(release) || release.includes(collectionName)) score += 2;
  if (artistName.includes("woodz")) score += 5;
  if (artistName.includes("조승연") || artistName.includes("choseungyoun")) score += 4;
  if (releaseAliasMatches(song, result)) score += 5;
  if (preferAlbum && collectionName === release) score += 4;
  if (result.wrapperType === "collection") score += 2;
  return score;
}

function selectArtwork(song, results, preferAlbum = false) {
  if (!results?.length) {
    return null;
  }

  const best = [...results]
    .map((result) => ({ result, score: scoreArtworkResult(song, result, preferAlbum) }))
    .sort((left, right) => right.score - left.score)[0];

  if (!best || best.score < 10 || !best.result.artworkUrl100) {
    return null;
  }

  return best.result.artworkUrl100.replace("100x100bb", "600x600bb");
}

function getArtworkUrl(song) {
  if (song.artworkUrl) {
    return song.artworkUrl;
  }
  return state.artworkCache.get(song.id) || null;
}

async function fetchArtwork(song) {
  if (state.artworkCache.has(song.id)) {
    return state.artworkCache.get(song.id);
  }

  if (state.artworkRequests.has(song.id)) {
    return state.artworkRequests.get(song.id);
  }

  const request = resolveArtwork(song)
    .then((artworkUrl) => {
      state.artworkCache.set(song.id, artworkUrl);
      state.artworkRequests.delete(song.id);
      renderAll();
      return artworkUrl;
    })
    .catch(() => {
      state.artworkCache.set(song.id, null);
      state.artworkRequests.delete(song.id);
      renderAll();
      return null;
    });

  state.artworkRequests.set(song.id, request);
  return request;
}

async function searchItunes(term, entity = "song", limit = 10) {
  const response = await fetch(buildArtworkLookupUrl(term, entity, limit));
  if (!response.ok) {
    throw new Error("artwork lookup failed");
  }
  return response.json();
}

async function resolveAlbumArtwork(song) {
  const albumKey = normalizeText(song.primaryRelease);
  if (state.albumArtworkCache.has(albumKey)) {
    return state.albumArtworkCache.get(albumKey);
  }

  if (state.albumArtworkRequests.has(albumKey)) {
    return state.albumArtworkRequests.get(albumKey);
  }

  const request = (async () => {
    const releaseKey = normalizeText(song.primaryRelease);
    const albumTerms = [
      ...(RELEASE_ARTWORK_SEARCH_TERMS[releaseKey] || []),
      `${song.primaryRelease} WOODZ`,
      `${song.primaryRelease} 조승연`,
      song.primaryRelease,
    ];

    for (const term of albumTerms) {
      const data = await searchItunes(term, "album", 8);
      const artworkUrl = selectArtwork(song, data.results, true);
      if (artworkUrl) {
        state.albumArtworkCache.set(albumKey, artworkUrl);
        state.albumArtworkRequests.delete(albumKey);
        return artworkUrl;
      }
    }

    state.albumArtworkCache.set(albumKey, null);
    state.albumArtworkRequests.delete(albumKey);
    return null;
  })().catch(() => {
    state.albumArtworkCache.set(albumKey, null);
    state.albumArtworkRequests.delete(albumKey);
    return null;
  });

  state.albumArtworkRequests.set(albumKey, request);
  return request;
}

async function resolveArtwork(song) {
  const albumArtwork = await resolveAlbumArtwork(song);
  if (albumArtwork) {
    return albumArtwork;
  }

  const manualTerms = MANUAL_ARTWORK_HINTS[song.title.toLowerCase()] || [];
  const searchTerms = [
    `${song.title} ${song.primaryRelease} WOODZ`,
    `${song.title} WOODZ`,
    `${song.title} 조승연`,
    `${song.primaryRelease} WOODZ ${song.title}`,
    ...manualTerms,
  ];

  for (const term of searchTerms) {
    const data = await searchItunes(term, "song", 10);
    const artworkUrl = selectArtwork(song, data.results);
    if (artworkUrl) {
      return artworkUrl;
    }
  }

  return null;
}

function prefetchArtwork(songs) {
  songs.forEach((song) => {
    if (!state.artworkCache.has(song.id) && !state.artworkRequests.has(song.id)) {
      fetchArtwork(song);
    }
  });
}

function renderArtwork(song) {
  const artworkUrl = getArtworkUrl(song);
  if (artworkUrl) {
    return `
      <div class="artwork-frame">
        <img class="artwork-image" src="${artworkUrl}" alt="${song.title} album cover" loading="lazy" />
      </div>
    `;
  }

  return `
    <div class="artwork-frame artwork-placeholder">
      <span>${song.primaryRelease}</span>
    </div>
  `;
}

function renderWeather() {
  const weatherMood = deriveWeatherMood(state.weather.tags);
  const timeLabel = getCurrentTimeLabel();
  elements.weatherStatus.textContent = state.weather.locationLabel;
  elements.weatherSummary.innerHTML = `
    <p class="weather-title">${state.weather.summary}</p>
    <p class="weather-subtitle">현지 시간 ${timeLabel} · ${state.weather.timezone || "Asia/Seoul"} · 날씨 해석 태그 ${weatherMood} · 사용자 감정 ${state.userContext.mood}</p>
  `;

  elements.weatherTags.innerHTML = "";
  state.weather.tags.forEach((tag) => {
    elements.weatherTags.appendChild(createChip(tag, "accent"));
  });
}

function renderRecommendations() {
  const recommendations = getActiveRecommendations().slice(0, 5);
  prefetchArtwork(recommendations.map(({ song }) => song));
  elements.recommendationCount.textContent = `${recommendations.length}곡`;
  elements.recommendationInsight.innerHTML = recommendations[0]
    ? `
      <p class="insight-title">오늘의 해석</p>
      <p class="insight-copy">${recommendations[0].song.title}가 가장 높은 점수를 받은 이유는 현재 날씨와 시간대, 그리고 지금 고른 무드가 가장 자연스럽게 연결되기 때문입니다. 현재 추천 소스는 ${state.recommendationFeed.source === "backend" ? "FastAPI backend" : "local fallback"}입니다.</p>
      ${state.recommendationFeed.error ? `<p class="insight-copy">${state.recommendationFeed.error}</p>` : ""}
    `
    : "";
  elements.recommendations.innerHTML = "";

  if (state.recommendationFeed.pending) {
    const pending = document.createElement("div");
    pending.className = "empty-state";
    pending.textContent = "추천 엔진이 현재 컨텍스트를 다시 계산하고 있습니다.";
    elements.recommendations.appendChild(pending);
    return;
  }

  if (!recommendations.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "선택한 조건과 날씨에 맞는 곡이 없습니다. 필터를 조금 넓혀보세요.";
    elements.recommendations.appendChild(empty);
    return;
  }

  recommendations.forEach(({ song, score, reason, components }, index) => {
    const youtubeMusicUrl = buildYoutubeMusicUrl(song);
    const card = document.createElement("article");
    card.className = "recommendation-card";
    card.innerHTML = `
      <div class="recommendation-side">
        <div class="recommendation-rank">#${index + 1}</div>
        ${renderArtwork(song)}
      </div>
      <div class="recommendation-body">
        <div class="recommendation-topline">
          <h3>${song.title}</h3>
          <span class="score-badge">${score.toFixed(2)}</span>
        </div>
        <p class="meta">${song.primaryRelease} · ${song.year || "-"}</p>
        <div class="chip-row">
          ${(song.emotionTags || []).map((mood) => `<span class="chip">${mood}</span>`).join("")}
        </div>
        <p class="lyrics-summary">${song.lyricsSummary || ""}</p>
        <div class="chip-row">
          ${(song.lyricsThemes || []).map((theme) => `<span class="chip chip-muted">${theme}</span>`).join("")}
        </div>
        <p class="reason">${reason}</p>
        <p class="score-breakdown">weather ${components.weatherScore} · mood ${components.moodScore} · time ${components.timeScore} · lyrics ${components.lyricsSimilarity}</p>
        <div class="action-row">
          <a class="music-link" href="${youtubeMusicUrl}" target="_blank" rel="noreferrer">YouTube Music에서 듣기</a>
        </div>
      </div>
    `;
    elements.recommendations.appendChild(card);
  });
}

function renderAll() {
  renderWeather();
  renderRecommendations();
}

async function fetchWeatherByCoordinates(latitude, longitude, label) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set(
    "current",
    "time,temperature_2m,weather_code,wind_speed_10m,is_day"
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("날씨 정보를 가져오지 못했습니다.");
  }

  const data = await response.json();
  state.weather = toWeatherState(label, data.current, data.timezone);
  renderAll();
  if (state.currentStep >= 3) {
    refreshRecommendations();
  }
}

async function fetchWeatherByCity(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "ko");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("도시 정보를 찾지 못했습니다.");
  }

  const data = await response.json();
  const result = data.results && data.results[0];
  if (!result) {
    throw new Error("입력한 도시를 찾지 못했습니다.");
  }

  await fetchWeatherByCoordinates(result.latitude, result.longitude, `${result.name}, ${result.country}`);
}

function setFallbackWeather() {
  state.weather = {
    locationLabel: "Seoul, South Korea",
    summary: "기본값 · 흐림 · 15°C · 낮",
    tags: ["cloudy", "mild", "day"],
    temperature: 15,
    code: 3,
    isDay: true,
    timezone: "Asia/Seoul",
    currentTime: toLocalTimeState(null, "Asia/Seoul"),
  };
  renderAll();
  if (state.currentStep >= 3) {
    refreshRecommendations();
  }
}

function bindEvents() {
  elements.startButton.addEventListener("click", () => {
    showStep(1);
  });

  elements.useLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setFallbackWeather();
      showStep(2);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await fetchWeatherByCoordinates(
            coords.latitude,
            coords.longitude,
            "현재 위치"
          );
          showStep(2);
        } catch (error) {
          setFallbackWeather();
          showStep(2);
        }
      },
      () => {
        setFallbackWeather();
        showStep(2);
      }
    );
  });

  elements.cityForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const city = elements.cityInput.value.trim();
    if (!city) {
      return;
    }

    try {
      await fetchWeatherByCity(city);
      showStep(2);
    } catch (error) {
      state.weather = {
        locationLabel: city,
        summary: "도시 날씨를 불러오지 못했습니다. 철자를 확인하거나 다른 도시명을 입력해 주세요.",
        tags: ["cloudy", "mild", "day"],
        temperature: null,
        code: null,
        isDay: true,
        timezone: "Asia/Seoul",
        currentTime: toLocalTimeState(null, "Asia/Seoul"),
      };
      renderAll();
      showStep(2);
    }
  });

  elements.moodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.userContext.mood = button.dataset.mood;
      elements.moodButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      showStep(3);
      refreshRecommendations();
    });
  });

  elements.backToLocationButton.addEventListener("click", () => {
    showStep(1);
  });

  elements.restartButton.addEventListener("click", () => {
    showStep(0);
  });
}

function initialize() {
  elements.moodButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mood === state.userContext.mood);
  });
  bindEvents();
  setFallbackWeather();
  showStep(0);
}

initialize();
