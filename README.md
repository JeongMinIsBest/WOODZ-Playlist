# WOODZ Weather Recommender

`WOODZ`의 솔로 곡 카탈로그를 정리하고, 곡마다 카테고리와 무드/날씨 태그를 붙인 뒤 오늘의 날씨에 맞춰 추천해주는 정적 웹앱입니다.

## 포함된 기능

- `WOODZ` 솔로 디스코그래피 카탈로그
- 릴리즈 기반 기본 태깅 + 곡별 세부 태그 오버라이드
- 현재 위치 또는 도시 검색 기반 날씨 조회
- 오늘 날씨에 따라 상위 추천 곡 계산
- Apple iTunes Search API 기반 앨범 커버 조회
- 모바일에서 설치 가능한 `PWA` 형태의 매니페스트

## 파일 구조

- [`index.html`](/Users/jeongmin/Documents/Playground/index.html): 앱 화면
- [`app.js`](/Users/jeongmin/Documents/Playground/app.js): 날씨 조회, 필터, 추천 로직
- [`catalog.js`](/Users/jeongmin/Documents/Playground/catalog.js): 전체 곡 카탈로그와 태그 데이터
- [`styles.css`](/Users/jeongmin/Documents/Playground/styles.css): UI 스타일
- [`manifest.webmanifest`](/Users/jeongmin/Documents/Playground/manifest.webmanifest): PWA 설정

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

카드는 `Apple iTunes Search API`를 사용해 `곡명 + 앨범명 + WOODZ` 조합으로 커버 이미지를 조회합니다. 검색 결과가 애매하거나 일치하는 항목이 없으면 텍스트 플레이스홀더를 대신 표시합니다.

## 날씨 추천 방식

앱은 Open-Meteo의 현재 날씨 정보를 가져와 다음 태그로 변환합니다.

- `sunny`, `cloudy`, `rainy`, `snowy`, `stormy`
- `cold`, `mild`, `hot`
- `day`, `night`

곡마다 저장된 `weatherTags`, `moods`, `settings`, `energy`와 현재 날씨 태그를 비교해서 점수를 계산하고 상위 곡을 추천합니다.

## 참고

이전의 Python CLI 프로토타입도 저장소에 남아 있지만, 현재 배포용 기준 구현은 웹앱입니다.
