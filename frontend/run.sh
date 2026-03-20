#!/bin/bash
# AiPod Flutter 실행 스크립트
# 사용법: ./run.sh [dev|prod] [android|ios] [서버URL]
#
# 예시:
#   ./run.sh                           → dev 모드, 기기 선택
#   ./run.sh dev android               → 안드로이드 에뮬레이터 개발 모드
#   ./run.sh dev ios                   → iOS 시뮬레이터 개발 모드
#   ./run.sh prod android https://api.aipod.com   → 안드로이드 서버 모드

ENV=${1:-dev}
PLATFORM=${2:-""}
API_URL=${3:-""}

DART_DEFINES="--dart-define=ENV=$ENV"

# iOS 여부 플래그 (AppConfig에서 platform 감지용)
if [ "$PLATFORM" = "ios" ]; then
  DART_DEFINES="$DART_DEFINES --dart-define=IS_IOS=true"
fi

# 커스텀 서버 URL
if [ -n "$API_URL" ]; then
  DART_DEFINES="$DART_DEFINES --dart-define=API_URL=$API_URL"
fi

# 기기 선택
if [ "$PLATFORM" = "android" ]; then
  DEVICE="emulator-5554"
elif [ "$PLATFORM" = "ios" ]; then
  DEVICE="8A495561-FEFD-42CB-801B-E21B965357D1"  # iPhone 16e 시뮬레이터
else
  DEVICE=""
fi

echo "▶ 환경: $ENV | 플랫폼: ${PLATFORM:-자동선택} | URL: ${API_URL:-기본값}"

if [ -n "$DEVICE" ]; then
  flutter run -d "$DEVICE" $DART_DEFINES
else
  flutter run $DART_DEFINES
fi
