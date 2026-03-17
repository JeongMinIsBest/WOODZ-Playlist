import { CATEGORY_OPTIONS, MOOD_OPTIONS, SONG_CATALOG } from "./catalog.js";

const state = {
  weather: {
    locationLabel: "위치 확인 중",
    summary: "브라우저 위치 권한을 허용하거나 도시를 검색해 주세요.",
    tags: ["loading"],
    temperature: null,
    code: null,
    isDay: true,
  },
  filters: {
    search: "",
    category: "all",
    mood: "all",
    energy: "all",
  },
  artworkCache: new Map(),
  artworkRequests: new Map(),
};

const elements = {
  useLocationButton: document.querySelector("#use-location"),
  cityForm: document.querySelector("#city-form"),
  cityInput: document.querySelector("#city-input"),
  weatherStatus: document.querySelector("#weather-status"),
  weatherSummary: document.querySelector("#weather-summary"),
  weatherTags: document.querySelector("#weather-tags"),
  categorySelect: document.querySelector("#category-select"),
  moodSelect: document.querySelector("#mood-select"),
  energySelect: document.querySelector("#energy-select"),
  searchInput: document.querySelector("#search-input"),
  recommendationCount: document.querySelector("#recommendation-count"),
  recommendations: document.querySelector("#recommendations"),
  catalogCount: document.querySelector("#catalog-count"),
  catalog: document.querySelector("#catalog"),
};

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

function toWeatherState(locationLabel, current) {
  const tags = deriveWeatherTags(current);
  const timeLabel = current.is_day ? "낮" : "밤";
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

function applyFilters(song) {
  const normalizedQuery = state.filters.search.trim().toLowerCase();
  if (normalizedQuery) {
    const haystack = [
      song.title,
      song.primaryRelease,
      ...song.releaseHistory,
      song.primaryCategory,
      ...song.categories,
      ...song.moods,
      ...song.weatherTags,
      ...song.settings,
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(normalizedQuery)) {
      return false;
    }
  }

  if (state.filters.category !== "all" && song.primaryCategory !== state.filters.category) {
    return false;
  }

  if (state.filters.mood !== "all" && !song.moods.includes(state.filters.mood)) {
    return false;
  }

  if (state.filters.energy !== "all" && energyBucket(song.energy) !== state.filters.energy) {
    return false;
  }

  return true;
}

function recommendSongs() {
  return SONG_CATALOG.filter(applyFilters)
    .map((song) => {
      const { score, reasons } = scoreSong(song, state.weather.tags);
      return {
        song,
        score,
        reasons: reasons.length ? reasons : ["기본 태그 기반 추천"],
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

function buildArtworkLookupUrl(song) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", `${song.title} ${song.primaryRelease} WOODZ`);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("country", "KR");
  url.searchParams.set("limit", "10");
  return url.toString();
}

function scoreArtworkResult(song, result) {
  const title = normalizeText(song.title);
  const release = normalizeText(song.primaryRelease);
  const trackName = normalizeText(result.trackName);
  const collectionName = normalizeText(result.collectionName);
  const artistName = normalizeText(result.artistName);

  let score = 0;
  if (trackName === title) score += 7;
  if (trackName.includes(title) || title.includes(trackName)) score += 3;
  if (collectionName === release) score += 5;
  if (collectionName.includes(release) || release.includes(collectionName)) score += 2;
  if (artistName.includes("woodz")) score += 5;
  if (artistName.includes("조승연") || artistName.includes("choseungyoun")) score += 4;
  return score;
}

function selectArtwork(song, results) {
  if (!results?.length) {
    return null;
  }

  const best = [...results]
    .map((result) => ({ result, score: scoreArtworkResult(song, result) }))
    .sort((left, right) => right.score - left.score)[0];

  if (!best || best.score < 5 || !best.result.artworkUrl100) {
    return null;
  }

  return best.result.artworkUrl100.replace("100x100bb", "600x600bb");
}

function getArtworkUrl(song) {
  return state.artworkCache.get(song.id) || null;
}

async function fetchArtwork(song) {
  if (state.artworkCache.has(song.id)) {
    return state.artworkCache.get(song.id);
  }

  if (state.artworkRequests.has(song.id)) {
    return state.artworkRequests.get(song.id);
  }

  const request = fetch(buildArtworkLookupUrl(song))
    .then((response) => {
      if (!response.ok) {
        throw new Error("artwork lookup failed");
      }
      return response.json();
    })
    .then((data) => {
      const artworkUrl = selectArtwork(song, data.results);
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
  elements.weatherStatus.textContent = state.weather.locationLabel;
  elements.weatherSummary.innerHTML = `
    <p class="weather-title">${state.weather.summary}</p>
    <p class="weather-subtitle">추천은 현재 날씨 코드, 기온, 낮/밤 정보에서 파생한 태그를 기준으로 계산합니다.</p>
  `;

  elements.weatherTags.innerHTML = "";
  state.weather.tags.forEach((tag) => {
    elements.weatherTags.appendChild(createChip(tag, "accent"));
  });
}

function renderRecommendations() {
  const recommendations = recommendSongs().slice(0, 8);
  prefetchArtwork(recommendations.map(({ song }) => song));
  elements.recommendationCount.textContent = `${recommendations.length}곡`;
  elements.recommendations.innerHTML = "";

  if (!recommendations.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "선택한 조건과 날씨에 맞는 곡이 없습니다. 필터를 조금 넓혀보세요.";
    elements.recommendations.appendChild(empty);
    return;
  }

  recommendations.forEach(({ song, score, reasons }, index) => {
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
          <span class="score-badge">${score} pts</span>
        </div>
        <p class="meta">${song.primaryRelease} · ${song.year} · ${song.primaryCategory}</p>
        <div class="chip-row">
          ${song.moods.map((mood) => `<span class="chip">${mood}</span>`).join("")}
        </div>
        <p class="reason">${reasons.join(" / ")}</p>
        <div class="action-row">
          <a class="music-link" href="${youtubeMusicUrl}" target="_blank" rel="noreferrer">YouTube Music에서 듣기</a>
        </div>
      </div>
    `;
    elements.recommendations.appendChild(card);
  });
}

function renderCatalog() {
  const filtered = SONG_CATALOG.filter(applyFilters);
  prefetchArtwork(filtered.slice(0, 24));
  elements.catalogCount.textContent = `${filtered.length}곡`;
  elements.catalog.innerHTML = "";

  filtered.forEach((song) => {
    const youtubeMusicUrl = buildYoutubeMusicUrl(song);
    const card = document.createElement("article");
    card.className = "catalog-card";
    card.innerHTML = `
      ${renderArtwork(song)}
      <div class="catalog-header">
        <div>
          <h3>${song.title}</h3>
          <p>${song.primaryRelease} · ${song.releaseType} · ${song.year}</p>
        </div>
        <span class="energy-badge">energy ${song.energy}</span>
      </div>
      <p class="catalog-category">${song.primaryCategory}</p>
      <div class="chip-row">
        ${song.categories.map((category) => `<span class="chip">${category}</span>`).join("")}
      </div>
      <div class="chip-row">
        ${song.moods.map((mood) => `<span class="chip chip-muted">${mood}</span>`).join("")}
      </div>
      <div class="chip-row">
        ${song.weatherTags.map((tag) => `<span class="chip chip-accent">${tag}</span>`).join("")}
      </div>
      <div class="action-row">
        <a class="music-link" href="${youtubeMusicUrl}" target="_blank" rel="noreferrer">YouTube Music 검색 열기</a>
      </div>
    `;
    elements.catalog.appendChild(card);
  });
}

function renderAll() {
  renderWeather();
  renderRecommendations();
  renderCatalog();
}

async function fetchWeatherByCoordinates(latitude, longitude, label) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,wind_speed_10m,is_day"
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("날씨 정보를 가져오지 못했습니다.");
  }

  const data = await response.json();
  state.weather = toWeatherState(label, data.current);
  renderAll();
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
  };
  renderAll();
}

function bindEvents() {
  elements.useLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setFallbackWeather();
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
        } catch (error) {
          setFallbackWeather();
        }
      },
      () => {
        setFallbackWeather();
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
    } catch (error) {
      state.weather = {
        locationLabel: city,
        summary: "도시 날씨를 불러오지 못했습니다. 철자를 확인하거나 다른 도시명을 입력해 주세요.",
        tags: ["cloudy", "mild", "day"],
        temperature: null,
        code: null,
        isDay: true,
      };
      renderAll();
    }
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderAll();
  });

  elements.categorySelect.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderAll();
  });

  elements.moodSelect.addEventListener("change", (event) => {
    state.filters.mood = event.target.value;
    renderAll();
  });

  elements.energySelect.addEventListener("change", (event) => {
    state.filters.energy = event.target.value;
    renderAll();
  });
}

function initialize() {
  populateSelect(elements.categorySelect, CATEGORY_OPTIONS, "카테고리");
  populateSelect(elements.moodSelect, MOOD_OPTIONS, "무드");
  bindEvents();
  setFallbackWeather();
}

initialize();
