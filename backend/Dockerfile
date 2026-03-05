# ─────────────────────────────────────────────
# Stage 1: Builder — TypeScript 컴파일
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 먼저 캐싱 (코드 변경 시 재설치 방지)
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Runner — 프로덕션 실행 이미지 (경량)
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

# Puppeteer(카드뉴스 렌더링)에 필요한 Chromium 의존성
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk

# Puppeteer가 시스템 Chromium을 사용하도록 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    TZ=Asia/Seoul

WORKDIR /app

# 프로덕션 의존성만 설치
COPY package*.json ./
RUN npm ci --omit=dev

# 빌드 결과물 복사
COPY --from=builder /app/dist ./dist

# 오디오/카드뉴스 저장 디렉터리 생성
RUN mkdir -p ./audio-files ./card-news-images

EXPOSE 3000

CMD ["node", "dist/main"]
