# WOODZ Weather Recommender

`WOODZ`의 솔로 곡 카탈로그를 정리하고, 현재 날씨, 시간대, 사용자 감정, 가사 의미 해석을 함께 반영해 플레이리스트를 추천하는 정적 웹앱입니다.

## 포함된 기능

- `WOODZ` 솔로 디스코그래피 카탈로그
- 릴리즈 기반 기본 태깅 + 곡별 세부 태그 오버라이드
- 현재 위치 또는 도시 검색 기반 날씨 조회
- 현재 시간대 반영
- 사용자 감정 선택과 자연어 입력 반영
- 가사 의미 요약과 테마 기반 설명형 추천
- 오늘의 플레이리스트 자동 생성
- Apple iTunes Search API 기반 앨범 커버 조회
- 모바일에서 설치 가능한 `PWA` 형태의 매니페스트

## 파일 구조

- [`index.html`](/Users/jeongmin/Documents/Playground/index.html): 앱 화면
- [`app.js`](/Users/jeongmin/Documents/Playground/app.js): 날씨 조회, 필터, 추천 로직
- [`catalog.js`](/Users/jeongmin/Documents/Playground/catalog.js): 전체 곡 카탈로그와 태그 데이터
- [`styles.css`](/Users/jeongmin/Documents/Playground/styles.css): UI 스타일
- [`manifest.webmanifest`](/Users/jeongmin/Documents/Playground/manifest.webmanifest): PWA 설정
- [`config.js`](/Users/jeongmin/Documents/Playground/config.js#L1): 배포 환경별 API 베이스 설정

## 로컬 실행

정적 사이트이므로 간단한 HTTP 서버만 띄우면 됩니다.

```bash
python3 -m http.server 4173
```

그 다음 브라우저에서 `http://localhost:4173`으로 접속하세요.

## 배포 방법

이 프로젝트는 빌드 과정이 없는 정적 사이트라서 아래 서비스에 바로 배포할 수 있습니다.

- `Netlify`: [`netlify.toml`](/Users/jeongmin/Documents/Playground/netlify.toml#L1)이 포함되어 있어 저장소만 연결하면 됩니다.
- `Vercel`: [`vercel.json`](/Users/jeongmin/Documents/Playground/vercel.json#L1)이 포함되어 있어 프레임워크 없이 static project로 바로 배포할 수 있습니다.
- `GitHub Pages`: 저장소 루트 또는 별도 Pages 브랜치에서 정적 파일 서빙

## YouTube Music 연결

추천 카드와 카탈로그 카드마다 `YouTube Music` 버튼이 들어가 있으며, 클릭하면 `곡명 + WOODZ` 검색 결과로 이동합니다. 고정 URL 대신 검색 링크를 사용해서 앨범 버전이나 공식 업로드가 바뀌어도 비교적 안정적으로 동작합니다.

## 앨범 커버

카드는 `Apple iTunes Search API`를 사용해 먼저 `앨범명 + WOODZ` 기준으로 커버를 찾고, 실패하면 `곡명 + WOODZ`, `곡명 + 조승연` 같은 검색어로 재시도합니다. 그래도 일치 항목이 없으면 텍스트 플레이스홀더를 대신 표시합니다.

## Backend MVP

명세서의 다음 단계 구현을 위해 [`backend/main.py`](/Users/jeongmin/Documents/Playground/backend/main.py#L1) 기준 `FastAPI` 백엔드를 추가했습니다.

- `POST /api/v1/recommendations`: 날씨, 시간, 사용자 감정, 자연어 입력을 받아 추천 생성
- `GET /api/v1/songs`: 현재 곡 데이터셋 조회
- `GET /health`: 헬스체크

백엔드 구조:

- [`backend/recommendation.py`](/Users/jeongmin/Documents/Playground/backend/recommendation.py#L1): 명세서 가중치 기반 추천 엔진
- [`backend/embeddings.py`](/Users/jeongmin/Documents/Playground/backend/embeddings.py#L1): OpenAI 임베딩 연동
- [`backend/weather.py`](/Users/jeongmin/Documents/Playground/backend/weather.py#L1): 날씨 API 해석
- [`backend/repository.py`](/Users/jeongmin/Documents/Playground/backend/repository.py#L1): Supabase 또는 로컬 저장소 계층
- [`backend/supabase/schema.sql`](/Users/jeongmin/Documents/Playground/backend/supabase/schema.sql#L1): Supabase 테이블/벡터 스키마

실행 예시:

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

프론트 연동:

- 정적 프론트는 실행 시 같은 오리진의 `/api/v1`를 먼저 찾고,
- 없으면 `http://127.0.0.1:8000/api/v1`, `http://localhost:8000/api/v1` 순서로 `FastAPI` 백엔드를 탐색합니다.
- [`config.js`](/Users/jeongmin/Documents/Playground/config.js#L1)에서 `window.WOODZ_API_BASE = "https://your-render-service.onrender.com/api/v1"` 형태로 지정하면 배포된 프론트가 Render 백엔드를 직접 바라보게 할 수 있습니다.
- 백엔드가 없거나 호출에 실패하면 기존 로컬 추천 엔진으로 자동 fallback 됩니다.

환경 변수는 [`.env.example`](/Users/jeongmin/Documents/Playground/.env.example#L1)를 기준으로 설정할 수 있습니다.

현재 구현 메모:

- 실제 임베딩 API는 OpenAI `text-embedding-3-small`을 기본값으로 사용합니다.
- OpenAI 임베딩은 텍스트를 수치 벡터로 바꿔 추천, 검색, 유사도 계산에 쓰도록 설계된 모델입니다. 공식 참고: [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings), [Embeddings API Reference](https://platform.openai.com/docs/api-reference/embeddings/create)
- 저작권 이슈 때문에 전체 가사 원문 대신 `lyrics_summary`와 `lyrics_themes`를 현재 기본 입력으로 사용합니다.

## Backend Deployment

백엔드 배포 설정도 추가했습니다.

- [`render.yaml`](/Users/jeongmin/Documents/Playground/render.yaml#L1): Render Blueprint 설정
- [`railway.json`](/Users/jeongmin/Documents/Playground/railway.json#L1): Railway 배포 설정

Render 기준:

- 저장소 루트에서 `pip install -r backend/requirements.txt`
- 시작 명령 `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- 헬스체크 경로 `/health`

Railway 기준:

- `RAILPACK` 빌더 사용
- 시작 명령 `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- 헬스체크 경로 `/health`

공식 참고:

- [Render FastAPI Deploy Docs](https://render.com/docs/deploy-fastapi)
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)
- [Railway FastAPI Guide](https://docs.railway.com/guides/fastapi)
- [Railway Build Configuration](https://docs.railway.com/reference/config-as-code)

## Supabase Seeding

로컬 카탈로그를 `Supabase`의 `songs` 테이블로 올리는 시드 스크립트도 추가했습니다.

- [`backend/scripts/seed_songs.py`](/Users/jeongmin/Documents/Playground/backend/scripts/seed_songs.py#L1)
- [`backend/scripts/embed_songs.py`](/Users/jeongmin/Documents/Playground/backend/scripts/embed_songs.py#L1)

실행 예시:

```bash
python3 backend/scripts/seed_songs.py --dry-run
python3 backend/scripts/seed_songs.py
python3 backend/scripts/seed_songs.py --truncate
```

설명:

- `--dry-run`: 실제 업로드 없이 전송될 데이터를 출력
- 기본 실행: `LOCAL_SONG_CATALOG`를 `upsert`
- `--truncate`: 기존 `songs` 테이블 데이터를 비우고 다시 채움

임베딩 업로드 예시:

```bash
python3 backend/scripts/embed_songs.py --dry-run --limit 3
python3 backend/scripts/embed_songs.py --only-missing
python3 backend/scripts/embed_songs.py
```

설명:

- `--dry-run`: 어떤 곡을 임베딩할지와 벡터 길이만 미리 확인
- `--only-missing`: `embedding`이 비어 있는 행만 처리
- 기본 실행: 모든 곡의 `embedding_text`를 OpenAI 임베딩으로 변환해 Supabase `embedding` 컬럼에 upsert

## 날씨 추천 방식

앱은 Open-Meteo의 현재 날씨 정보를 가져와 다음 태그로 변환합니다.

- `sunny`, `cloudy`, `rainy`, `snowy`, `stormy`
- `cold`, `mild`, `hot`
- `day`, `night`

곡마다 저장된 `weatherTags`, `emotionTags`, `timeTags`, `lyricsThemes`, `lyricsSummary`, `energy`와 현재 날씨/시간/사용자 입력을 비교해 점수를 계산합니다.

## MVP 추천 점수

앱은 아래 가중치를 기준으로 추천 점수를 계산합니다.

- `0.35` weather score
- `0.25` mood score
- `0.20` time score
- `0.20` lyrics similarity

## 참고

이전의 Python CLI 프로토타입도 저장소에 남아 있지만, 현재 배포용 기준 구현은 웹앱입니다.
