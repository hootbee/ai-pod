# AiPod Frontend

## 실행 방법

### 1) 로컬 백엔드(개발 PC의 3000번) 붙여서 실행

- iOS/Android/Desktop 공통:

```bash
flutter run --dart-define=ENV=dev
```

- Web:

```bash
flutter run -d chrome --web-port 7357 --dart-define=ENV=dev
```

참고:
- `ENV=dev`일 때 API 기본값은 플랫폼별로 자동 분기됩니다.
- Android 에뮬레이터는 `http://10.0.2.2:3000`으로 연결됩니다.
- Web/iOS/macOS 기본값은 현재 `http://192.168.0.18:3000`입니다.
- iOS 실기기는 로컬 개발 서버에 붙일 때 `DEV_HOST`로 개발 PC IP를 명시하는 편이 안전합니다.

```bash
flutter run -d <IOS_DEVICE_ID> --dart-define=ENV=dev --dart-define=DEV_HOST=<맥IP>
```

### 2) 서버 백엔드 붙여서 실행

아래처럼 `ENV=production`과 서버 API 주소(`API_URL`)를 **반드시** 같이 지정해서 실행하세요.
(`production` 모드에서 `API_URL` 누락 시 앱이 시작 단계에서 에러를 발생시킵니다.)

```bash
flutter run \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://your-server:3000
```

- iOS 실기기 예시:

```bash
flutter run -d <IOS_DEVICE_ID> \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://your-server:3000 \
  --dart-define=GOOGLE_CLIENT_ID=<google-web-client-id>
```

- Chrome 예시:

```bash
flutter run -d chrome --web-port 7357 \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://your-server:3000 \
  --dart-define=GOOGLE_CLIENT_ID=<google-web-client-id>
```

### 3) Chrome 웹 테스트용 실행

- 운영 서버 붙여서 테스트:

```bash
flutter run -d chrome --web-port 7357 \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://54.180.201.105:3000 \
  --dart-define=GOOGLE_CLIENT_ID=826440481147-effr7vmiuqh5d0tujtne4e726ft14ttr.apps.googleusercontent.com
```

- 로컬 개발 서버 붙여서 테스트:

```bash
flutter run -d chrome --web-port 7357 --dart-define=ENV=dev
```
