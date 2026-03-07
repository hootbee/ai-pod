# AiPod Frontend

## 실행 방법

### 1) 로컬 백엔드(개발 PC의 3000번) 붙여서 실행

- iOS/Android/Desktop 공통:

```bash
flutter run --dart-define=ENV=dev
```

- Web:

```bash
flutter run -d chrome --dart-define=ENV=dev
```

참고:
- `ENV=dev`일 때 API 기본값은 플랫폼별로 자동 분기됩니다.
- Android 에뮬레이터는 `http://10.0.2.2:3000`으로 연결됩니다.
- iOS 시뮬레이터/웹/데스크톱은 `http://localhost:3000`으로 연결됩니다.

### 2) 서버 백엔드 붙여서 실행

아래처럼 `ENV=production`과 서버 API 주소를 같이 지정해서 실행하세요.

```bash
flutter run \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://<서버IP또는도메인>:3000
```

예시:

```bash
flutter run \
  --dart-define=ENV=production \
  --dart-define=API_URL=https://api.aipod.com
```
