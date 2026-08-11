# AiPod Backend

AI 기반 IT 팟캐스트 자동 생성 백엔드 서버입니다.  
뉴스 크롤링 → AI 스크립트 생성 → 카드뉴스 생성 → TTS 오디오 변환 파이프라인을 자동으로 제공합니다.

---

## 기술 스택

- **Runtime**: Node.js + NestJS (TypeScript)
- **DB**: PostgreSQL 15
- **Cache**: Redis 7 (BullMQ 큐)
- **AI**: Google Gemini 2.5 Flash (스크립트, 카드뉴스, 헤드라인)
- **TTS**: Google Cloud Text-to-Speech Chirp 3 HD API
- **카드뉴스 렌더링**: Puppeteer (HTML → 1080×1080 PNG)
- **이미지 검색**: Unsplash API

---

## 사전 준비

- Node.js 20+
- Docker & Docker Compose
- Gemini API 키 ([발급](https://aistudio.google.com/app/apikey))
- Google Cloud TTS API 키 ([Cloud Console](https://console.cloud.google.com))
- Unsplash API 키 ([발급](https://unsplash.com/developers))
- Google OAuth Web Client ID ([Firebase Console](https://console.firebase.google.com) → Authentication → Google)

---

## 초기 설정

### 1. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일에서 아래 항목을 필수로 채웁니다:

```env
# DB
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=aipod_db

# AI (Mindlogic / Gemini)
MINDLOGIC_API_KEY=your_mindlogic_api_key
MINDLOGIC_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/api/google/models/generate-content
MINDLOGIC_MODEL=gemini-2.5-flash

# Google OAuth (로그인 검증용)
GOOGLE_CLIENT_ID=711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com

# Google Cloud TTS
GOOGLE_CLOUD_TTS_API_KEY=your_google_cloud_tts_key

# Unsplash (카드뉴스 이미지)
UNSPLASH_ACCESS_KEY=your_unsplash_key

# 알림 (선택)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# 파이프라인 설정
MIN_ARTICLES=3
```

### 2. Docker 서비스 실행

```bash
# PostgreSQL + Redis 실행
docker compose up -d postgres redis
```

### 3. 패키지 설치 및 서버 실행

```bash
npm install
npm run start:dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

---

## 자동화 파이프라인

매일 **KST 04:00**에 자동으로 실행되며 아래 순서로 동작합니다:

```
1. 크롤링       뉴스 기사 수집 (TechCrunch, The Verge 등 6개 소스)
2. AI 스크립트  Gemini로 팟캐스트 대본 생성 (60초 timeout, 2회 재시도)
3. DB 저장      PodcastEpisode 생성
3.5 헤드라인    스크립트에서 가장 자극적인 토픽 → 클릭베이트 제목 + 부제 생성
4. 카드뉴스     주제별 PNG 슬라이드 생성 (Puppeteer)
5. TTS          Google Cloud TTS로 오디오 생성 (Bull Queue 비동기)
6. Discord 알림 성공/경고/실패 알림 발송
```

부분 실패(카드뉴스, TTS)는 에피소드를 유지하고 개별 재시도 가능합니다.

### 수동 실행 API

```bash
# 파이프라인 즉시 실행
curl -X POST http://localhost:3000/pipeline/run

# 오늘 에피소드가 있어도 강제 재실행
curl -X POST "http://localhost:3000/pipeline/run?force=true"

# DB/캐시/생성 파일 초기화 후 전체 실행
curl -X POST http://localhost:3000/pipeline/reset-and-run

# 카드뉴스만 재생성
curl -X POST http://localhost:3000/pipeline/retry-cardnews/<episodeId>

# TTS만 재큐 등록
curl -X POST http://localhost:3000/pipeline/retry-tts/<episodeId>
```

---

## API 엔드포인트

### 인증

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/auth/google` | 구글 로그인 (idToken → JWT 발급) |
| `POST` | `/auth/refresh` | Access Token 갱신 |
| `POST` | `/auth/logout` | 로그아웃 |
| `GET` | `/auth/me` | 내 정보 조회 |

### 에피소드

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/episodes` | 전체 에피소드 목록 |
| `GET` | `/episodes/:id` | 에피소드 상세 |
| `POST` | `/episodes/:id/generate-audio` | TTS 오디오 생성 큐 등록 |
| `POST` | `/episodes/:id/generate-headline` | 클릭베이트 헤드라인 + 부제 생성 |
| `PATCH` | `/episodes/:id/audio-path` | 오디오 경로 수동 업데이트 |

### 카드뉴스

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/card-news/test/:episodeId` | 1장만 생성 (디자인 확인용) |
| `POST` | `/card-news/generate/:episodeId` | 전체 슬라이드 생성 |
| `GET` | `/card-news/:episodeId` | 생성된 카드뉴스 조회 |

### 파이프라인

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/pipeline/run` | 전체 파이프라인 즉시 실행 |
| `POST` | `/pipeline/run?force=true` | 오늘 데이터가 있어도 강제 실행 |
| `POST` | `/pipeline/reset-and-run` | DB/Redis/생성 파일 초기화 후 전체 파이프라인 실행 |
| `POST` | `/pipeline/retry-cardnews/:episodeId` | 카드뉴스만 재생성 |
| `POST` | `/pipeline/retry-tts/:episodeId` | TTS만 재큐 등록 |

---

## 뉴스 소스

| 소스 | 특징 |
|------|------|
| TechCrunch | 스타트업 / 투자 |
| The Verge | 소비자 기술 |
| Ars Technica | 심층 기술 분석 |
| WIRED | 사회 / 문화적 테크 |
| VentureBeat | AI / ML 특화 |
| MIT Technology Review | 기술 연구 / 심층 분석 |

---

## 개발 유틸리티

```bash
# DB 에피소드 전체 삭제 (테스트 초기화)
docker exec aipod-postgres psql -U myuser -d aipod_db -c "DELETE FROM podcast_episodes;"

# Redis 크롤러 캐시 초기화 (기사 재수집 허용)
docker exec aipod-redis redis-cli --scan --pattern "crawler:processed:*" \
  | xargs docker exec -i aipod-redis redis-cli DEL

# 카드뉴스 1장 빠른 테스트
curl -X POST http://localhost:3000/card-news/test/$(
  PGPASSWORD=mypassword psql -h localhost -U myuser -d aipod_db -t \
  -c "SELECT id FROM podcast_episodes ORDER BY \"createdAt\" DESC LIMIT 1;" | tr -d ' \n'
)
```

---

## 환경변수 전체 목록

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3000` | 서버 포트 |
| `APP_LATEST_VERSION` | `1.0.8` | Play Store 최신 앱 버전 |
| `APP_MINIMUM_VERSION` | `1.0.0` | 지원하는 최소 앱 버전 |
| `APP_LATEST_BUILD_NUMBER` | `9` | Play Store 최신 build number |
| `APP_MINIMUM_BUILD_NUMBER` | `1` | 지원하는 최소 build number |
| `APP_FORCE_UPDATE` | `false` | 최신 버전 업데이트 강제 여부 |
| `APP_STORE_URL` | AiPod Play Store URL | 업데이트 버튼이 여는 스토어 주소 |
| `DB_HOST` | `localhost` | PostgreSQL 호스트 |
| `DB_PORT` | `5432` | PostgreSQL 포트 |
| `DB_USER` | `myuser` | DB 사용자 |
| `DB_PASSWORD` | `mypassword` | DB 비밀번호 |
| `DB_NAME` | `aipod_db` | DB 이름 |
| `DB_SYNC` | `true` | TypeORM auto-sync (운영 시 `false`) |
| `REDIS_URL` | `redis://localhost:6379` | Redis 연결 URL |
| `MINDLOGIC_API_KEY` | — | Mindlogic API 키 (필수) |
| `MINDLOGIC_BASE_URL` | — | Mindlogic 엔드포인트 |
| `MINDLOGIC_MODEL` | `gemini-2.5-flash` | 사용할 모델명 |
| `GOOGLE_CLIENT_ID` | — | Google OAuth Web Client ID (필수) |
| `GOOGLE_IOS_CLIENT_ID` | — | iOS Client ID (iOS 앱 지원 시) |
| `GOOGLE_CLOUD_TTS_API_KEY` | — | Google Cloud TTS API 키 (필수) |
| `UNSPLASH_ACCESS_KEY` | — | Unsplash API 키 (카드뉴스용) |
| `CARD_NEWS_OUTPUT_DIR` | `./card-news-images` | 카드뉴스 PNG 저장 경로 |
| `AUDIO_OUTPUT_DIR` | `./audio-files` | 오디오 파일 저장 경로 |
| `DISCORD_WEBHOOK_URL` | — | Discord 알림 웹훅 URL (선택) |
| `MIN_ARTICLES` | `3` | 파이프라인 실행 최소 기사 수 |
| `JWT_SECRET` | — | JWT 서명 키 (필수) |
| `JWT_ACCESS_EXPIRES_IN` | `3600` | Access Token 만료 (초) |
| `JWT_REFRESH_SECRET` | — | Refresh Token 서명 키 (필수) |
| `AUTH_AUDIT_IP_HASH_SECRET` | — | 인증 감사 로그 IP 해시용 비밀키 (선택) |

인증 감사 로그는 `auth_audit_logs`에 로그인, refresh, logout 성공·실패 이력을 저장합니다. IP 주소는 원문으로 저장하지 않고 `AUTH_AUDIT_IP_HASH_SECRET`이 설정된 경우에만 해시로 저장합니다. Refresh Token은 `refresh_tokens.revokedAt`으로 폐기 시각을 보존하며 원문 토큰은 저장하지 않습니다.
