# AiPod Frontend

## Google 로그인 설정 파일

모바일(iOS/Android)에서 Google 로그인을 사용하려면 아래 파일이 필요합니다.

- Android: `frontend/android/app/google-services.json`
- iOS: `frontend/ios/Runner/GoogleService-Info.plist`

참고:
- Web(Chrome) 실행만 할 때는 위 파일보다 `GOOGLE_CLIENT_ID`가 더 중요합니다.
- iOS 폴더에 `frontend/ios/GoogleService-Info.plist`가 하나 더 있을 수 있지만, 실제 Xcode 프로젝트 기준 경로는 `frontend/ios/Runner/GoogleService-Info.plist`입니다.

팀원에게 공유할 때는 아래처럼 두면 됩니다.

```text
frontend/
  android/
    app/
      google-services.json
  ios/
    Runner/
      GoogleService-Info.plist
```

## 실행 방법

### 1) 개발 모드로 실행

- iOS/Android/Desktop 공통:

```bash
flutter run --dart-define=ENV=dev
```

- Web:

```bash
flutter run -d chrome --web-port 7357 --dart-define=ENV=dev
```

참고:
- 현재 개발 모드의 기본 API 주소는 `http://168.138.214.118:3000`입니다.
- 로컬 백엔드에 연결하려면 플랫폼에 맞는 주소를 `API_URL` 또는 `DEV_HOST`로 직접 지정해야 합니다.
- Android 에뮬레이터에서 같은 컴퓨터의 백엔드를 사용할 때는 `DEV_HOST=10.0.2.2`를 사용합니다.
- iOS 실기기에서 같은 컴퓨터의 백엔드를 사용할 때는 `DEV_HOST=<맥의_로컬_IP>`를 사용합니다.

```bash
flutter run -d <IOS_DEVICE_ID> \
  --dart-define=ENV=dev \
  --dart-define=DEV_HOST=<맥의_로컬_IP> \
  --dart-define=GOOGLE_CLIENT_ID=711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com
```

### 2) 서버 백엔드 붙여서 실행

아래처럼 `ENV=production`과 서버 API 주소(`API_URL`)를 **반드시** 같이 지정해서 실행하세요.
(`production` 모드에서 `API_URL` 누락 시 앱이 시작 단계에서 에러를 발생시킵니다.)

```bash
flutter run \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://168.138.214.118:3000
```

- iOS 실기기 예시:

```bash
flutter run -d <IOS_DEVICE_ID> \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://168.138.214.118:3000 \
  --dart-define=GOOGLE_CLIENT_ID=711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com
```

- Chrome 예시:

```bash
flutter run -d chrome --web-port 7357 \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://168.138.214.118:3000 \
  --dart-define=GOOGLE_CLIENT_ID=711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com
```

### 3) Chrome 웹 테스트용 실행

- 운영 서버 붙여서 테스트:

```bash
flutter run -d chrome --web-port 7357 \
  --dart-define=ENV=production \
  --dart-define=API_URL=http://168.138.214.118:3000 \
  --dart-define=GOOGLE_CLIENT_ID=711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com
```
- 로컬 개발 서버 붙여서 테스트:

```bash
flutter run -d chrome --web-port 7357 \
  --dart-define=ENV=dev \
  --dart-define=API_URL=http://127.0.0.1:3000 \
  --dart-define=GOOGLE_CLIENT_ID=711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com
```

### 4) Windows에서 Chrome 웹 실행 시 주의

macOS/Linux 예시처럼 줄 끝에 `\`를 붙인 명령은 Windows `cmd`/PowerShell에서 그대로 동작하지 않을 수 있습니다.

- 가장 안전한 방법: 한 줄로 실행

```bash
flutter run -d chrome --web-port 7357 --dart-define=ENV=production --dart-define=API_URL=http://168.138.214.118:3000 --dart-define=GOOGLE_CLIENT_ID=711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com
```

- PowerShell에서 여러 줄로 쓰고 싶으면 줄 끝에 백슬래시(`\`)가 아니라 백틱(<code>`</code>)을 사용
- `cmd`에서는 줄 끝에 `^`를 사용
