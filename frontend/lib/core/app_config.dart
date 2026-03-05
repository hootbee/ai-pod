/// 환경 설정 — 빌드 시 --dart-define=ENV=production 으로 주입
///
/// 개발 모드 실행:
///   flutter run                          (기본값, dev)
///   flutter run --dart-define=ENV=dev
///
/// 서버 모드 실행:
///   flutter run --dart-define=ENV=production --dart-define=API_URL=https://api.aipod.com
library;

enum AppEnv { dev, production }

class AppConfig {
  AppConfig._();

  /// 현재 환경 (기본값: dev)
  static const String _envStr =
      String.fromEnvironment('ENV', defaultValue: 'dev');

  static AppEnv get env =>
      _envStr == 'production' ? AppEnv.production : AppEnv.dev;

  static bool get isDev => env == AppEnv.dev;
  static bool get isProd => env == AppEnv.production;

  /// 백엔드 API Base URL
  /// --dart-define=API_URL=https://your-server.com 으로 오버라이드 가능
  static String get apiBaseUrl {
    const custom = String.fromEnvironment('API_URL', defaultValue: '');
    if (custom.isNotEmpty) return custom;

    // 기본값: 환경에 따라 자동 선택
    if (isProd) return 'https://api.aipod.com'; // ← 실제 서버 URL로 변경
    // dev: 플랫폼에 따라 자동 분기
    return _devUrl;
  }

  static String get _devUrl {
    // dart:io Platform은 web에서 동작 안 하므로 String.fromEnvironment 활용
    const isIos = bool.fromEnvironment('IS_IOS', defaultValue: false);
    return isIos ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  }

  static String get envLabel =>
      isProd ? '🚀 Production' : '🛠 Development';
}
