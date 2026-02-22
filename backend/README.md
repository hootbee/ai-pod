# AiPod Backend

AI 기반 IT 팟캐스트 자동 생성 백엔드 서버입니다.  
뉴스 크롤링 → AI 스크립트 생성 → TTS 오디오 변환 파이프라인을 제공합니다.

---

## 기술 스택

- **Runtime**: Node.js + NestJS (TypeScript)
- **DB**: PostgreSQL 15
- **Cache**: Redis 7
- **AI**: Google Gemini 2.5 Flash
- **TTS**: Fish Speech v1.5 (Docker, CPU)

---

## 사전 준비

- Node.js 20+
- Docker & Docker Compose
- Python 3.x + `huggingface_hub` (TTS 모델 다운로드용)
- Gemini API 키 ([발급](https://aistudio.google.com/app/apikey))
- Hugging Face 계정 ([가입](https://huggingface.co/join))

---

## 초기 설정

### 1. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 항목을 채웁니다:

```env
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=aipod_db

GEMINI_API_KEY=your_gemini_api_key_here

FISH_SPEECH_URL=http://localhost:8080
AUDIO_OUTPUT_DIR=./audio-files
```

### 2. TTS 모델 다운로드 (Fish Speech)

> TTS 기능을 사용하지 않는다면 이 단계를 건너뛰어도 됩니다.

```bash
# huggingface_hub 설치
pip install "huggingface_hub[cli]"

# HuggingFace 로그인 (토큰 필요: https://huggingface.co/settings/tokens)
hf login

# 모델 다운로드 (~500MB)
hf download fishaudio/openaudio-s1-mini \
  --local-dir ./checkpoints/openaudio-s1-mini
```

> `fishaudio/openaudio-s1-mini`는 Gated 리포지토리입니다.  
> [여기서](https://huggingface.co/fishaudio/openaudio-s1-mini) "Access Repository"를 먼저 클릭해주세요.

### 3. Docker 서비스 실행

```bash
# PostgreSQL + Redis 실행
docker compose up -d postgres redis

# TTS 서버 실행 (모델 다운로드 완료 후)
docker compose up -d fish-speech
```

### 4. 패키지 설치 및 서버 실행

```bash
npm install
npm run start:dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

---

## API 엔드포인트

### 파이프라인

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/pipeline/briefing/run` | 뉴스 수집 → 스크립트 생성 → DB 저장 |
| `POST` | `/pipeline/briefing/preview` | DB 저장 없이 스크립트만 미리보기 |

**요청 파라미터 (선택)**

```json
{
  "limitPerSource": 5,
  "maxArticles": 10
}
```

### 에피소드

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/episodes` | 전체 에피소드 목록 |
| `GET` | `/episodes/:id` | 에피소드 상세 |
| `POST` | `/episodes/:id/generate-audio` | TTS 오디오 생성 |
| `PATCH` | `/episodes/:id/audio-path` | 오디오 경로 수동 업데이트 |

---

## 파이프라인 실행 예시

```bash
# 기본 실행 (기사 10개)
curl -X POST http://localhost:3000/pipeline/briefing/run

# 최대 기사 수로 실행 (기사 20개)
curl -X POST http://localhost:3000/pipeline/briefing/run \
  -H "Content-Type: application/json" \
  -d '{"limitPerSource": 5, "maxArticles": 20}'

# TTS 오디오 생성
curl -X POST http://localhost:3000/episodes/<EPISODE_ID>/generate-audio
```

---

## 뉴스 소스

| 소스 | 성향 |
|------|------|
| TechCrunch | 스타트업 / 투자 |
| The Verge | 소비자 기술 |
| Ars Technica | 심층 기술 분석 |
| WIRED | 사회 / 문화적 테크 |
| VentureBeat | AI / ML 특화 |
| MIT Technology Review | 기술 연구 / 심층 분석 |

---

## 개발 초기화 (테스트 재시작 시)

```bash
# DB 에피소드 전체 삭제
docker exec aipod-postgres psql -U myuser -d aipod_db -c "DELETE FROM podcast_episodes;"

# Redis 크롤러 캐시 초기화 (기사 재수집 허용)
docker exec aipod-redis redis-cli --scan --pattern "crawler:processed:*" \
  | xargs docker exec -i aipod-redis redis-cli DEL
```

---

## 환경변수 전체 목록

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3000` | 서버 포트 |
| `DB_HOST` | `localhost` | PostgreSQL 호스트 |
| `DB_PORT` | `5432` | PostgreSQL 포트 |
| `DB_USER` | `myuser` | DB 사용자 |
| `DB_PASSWORD` | `mypassword` | DB 비밀번호 |
| `DB_NAME` | `aipod_db` | DB 이름 |
| `DB_SYNC` | `true` | TypeORM auto-sync (운영환경에서는 false) |
| `REDIS_URL` | `redis://localhost:6379` | Redis 연결 URL |
| `LLM_TYPE` | `gemini` | AI 프로바이더 선택 |
| `GEMINI_API_KEY` | — | Gemini API 키 (필수) |
| `FISH_SPEECH_URL` | `http://localhost:8080` | Fish Speech 서버 URL |
| `AUDIO_OUTPUT_DIR` | `./audio-files` | 생성된 오디오 저장 경로 |
