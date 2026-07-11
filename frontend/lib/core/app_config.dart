/// 환경 설정 — 빌드 시 --dart-define=ENV=production 으로 주입
///
/// 개발 모드 실행:
///   flutter run                          (기본값, dev)
///   flutter run --dart-define=ENV=dev
///
/// 서버 모드 실행:
///   flutter run --dart-define=ENV=production --dart-define=API_URL=http://your-server:3000
library;

import 'package:flutter/foundation.dart';

enum AppEnv { dev, production }

class AppConfig {
  AppConfig._();

  static const String _defaultRemoteApiUrl = 'http://168.138.214.118:3000';

  /// 현재 환경 (기본값: dev)
  static const String _envStr = String.fromEnvironment(
    'ENV',
    defaultValue: 'dev',
  );

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
    if (isProd) {
      throw StateError(
        'API_URL is required in production. '
        'Run with --dart-define=API_URL=http://your-server:3000',
      );
    }
    // dev: 플랫폼에 따라 자동 분기
    return _devUrl;
  }

  static String get _devUrl {
    if (kIsWeb) return _defaultRemoteApiUrl;
    const devHost = String.fromEnvironment('DEV_HOST', defaultValue: '');

    if (devHost.isNotEmpty) {
      return devHost.startsWith('http://') || devHost.startsWith('https://')
          ? devHost
          : 'http://$devHost:3000';
    }

    return _defaultRemoteApiUrl;
  }

  static String get envLabel => isProd ? '🚀 Production' : '🛠 Development';
}
