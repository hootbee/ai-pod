import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../core/app_config.dart';
import '../../shared/models/user_profile.dart';

abstract interface class AuthTokenStore {
  Future<String?> read({required String key});
  Future<void> write({required String key, required String value});
  Future<void> delete({required String key});
}

class _SecureAuthTokenStore implements AuthTokenStore {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  @override
  Future<String?> read({required String key}) => _storage.read(key: key);

  @override
  Future<void> write({required String key, required String value}) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete({required String key}) => _storage.delete(key: key);
}

class AuthService {
  // URL은 AppConfig에서 환경별로 자동 결정됨
  static String get _backendUrl => AppConfig.apiBaseUrl;
  static const _googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue:
        '711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com',
  );

  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const String _genericAuthError =
      '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  static const Duration _googleSignInTimeout = Duration(seconds: 30);
  static const Duration _googleAuthTokenTimeout = Duration(seconds: 20);
  static final AuthTokenStore _defaultTokenStore = _SecureAuthTokenStore();

  static final GoogleSignIn googleSignIn = kIsWeb
      ? GoogleSignIn(clientId: _googleClientId)
      : GoogleSignIn(serverClientId: _googleClientId);

  String? _accessToken;
  String? _refreshToken;
  final http.Client _httpClient;
  final AuthTokenStore _tokenStore;

  AuthService({http.Client? httpClient, AuthTokenStore? tokenStore})
    : _httpClient = httpClient ?? http.Client(),
      _tokenStore = tokenStore ?? _defaultTokenStore;

  String? get accessToken => _accessToken;
  bool get isLoggedIn => _accessToken != null;

  /// 앱 시작 시 저장된 토큰 로드 → 유효하면 true, 아니면 false
  Future<bool> tryAutoLogin() async {
    _accessToken = await _tokenStore.read(key: _keyAccessToken);
    _refreshToken = await _tokenStore.read(key: _keyRefreshToken);

    if (_accessToken == null) return false;

    // 토큰 유효성 검사 (GET /auth/me)
    try {
      final response = await _httpClient
          .get(
            Uri.parse('$_backendUrl/auth/me'),
            headers: {'Authorization': 'Bearer $_accessToken'},
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) return true;

      // Access token 만료일 때만 refresh를 시도한다.
      if (response.statusCode == 401) {
        if (_refreshToken == null) {
          await _clearTokens();
          return false;
        }

        try {
          await _refresh();
          return true;
        } catch (_) {
          await _clearTokens();
          return false;
        }
      }

      // 서버 오류나 일시적인 비정상 응답만으로 세션을 삭제하지 않는다.
      return true;
    } catch (_) {}

    // 네트워크 오류로는 저장된 세션을 삭제하지 않는다.
    return true;
  }

  Future<Map<String, dynamic>> loginWithGoogle() async {
    if (_googleClientId.isEmpty) {
      throw StateError(
        'GOOGLE_CLIENT_ID is required. Pass with --dart-define=GOOGLE_CLIENT_ID=...',
      );
    }

    debugPrint('Google sign-in: launching account picker');
    final account = await googleSignIn.signIn().timeout(
      _googleSignInTimeout,
      onTimeout: () {
        throw TimeoutException(
          'Google 계정 선택이 시간 내에 완료되지 않았습니다.',
          _googleSignInTimeout,
        );
      },
    );
    if (account == null) throw Exception('Google 로그인이 취소되었습니다.');
    debugPrint('Google sign-in: selected account=${account.email}');
    return loginWithGoogleAccount(account);
  }

  /// Google 계정 정보로 백엔드 JWT 발급
  Future<Map<String, dynamic>> loginWithGoogleAccount(
    GoogleSignInAccount account,
  ) async {
    debugPrint('Google sign-in: requesting authentication tokens');
    final auth = await account.authentication.timeout(
      _googleAuthTokenTimeout,
      onTimeout: () {
        throw TimeoutException(
          'Google 인증 토큰을 받는 데 시간이 초과되었습니다.',
          _googleAuthTokenTimeout,
        );
      },
    );
    final idToken = auth.idToken;
    final accessToken = auth.accessToken;
    debugPrint(
      'Google sign-in: token availability idToken=${idToken != null} accessToken=${accessToken != null}',
    );
    if (idToken == null && accessToken == null) {
      throw Exception(_genericAuthError);
    }

    final payload = <String, String>{};
    if (idToken != null) payload['idToken'] = idToken;
    if (accessToken != null) payload['accessToken'] = accessToken;

    final response = await _httpClient
        .post(
          Uri.parse('$_backendUrl/auth/google'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 15));

    debugPrint(
      'Google sign-in: backend response status=${response.statusCode}',
    );
    if (response.statusCode != 200) {
      throw Exception(
        _buildAuthErrorMessage(response.statusCode, response.body),
      );
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    _accessToken = data['accessToken'] as String?;
    _refreshToken = data['refreshToken'] as String?;

    // 토큰 로컬 저장
    await _saveTokens();
    return data;
  }

  String _buildAuthErrorMessage(int statusCode, String responseBody) {
    final trimmedBody = responseBody.trim();
    if (trimmedBody.isEmpty) {
      return '로그인 실패 (HTTP $statusCode)';
    }

    try {
      final decoded = jsonDecode(trimmedBody);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'];
        if (message is String && message.trim().isNotEmpty) {
          return '로그인 실패: $message (HTTP $statusCode)';
        }
        if (message is List && message.isNotEmpty) {
          return '로그인 실패: ${message.join(', ')} (HTTP $statusCode)';
        }
      }
    } catch (_) {}

    return '로그인 실패 (HTTP $statusCode): $trimmedBody';
  }

  /// Access Token 갱신
  Future<void> _refresh() async {
    if (_refreshToken == null) throw Exception('로그인이 필요합니다.');

    final response = await _httpClient
        .post(
          Uri.parse('$_backendUrl/auth/refresh'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': _refreshToken}),
        )
        .timeout(const Duration(seconds: 10));

    if (response.statusCode != 200) throw Exception('세션 갱신에 실패했습니다.');

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    _accessToken = data['accessToken'] as String?;
    _refreshToken = data['refreshToken'] as String?;
    await _saveTokens();
  }

  /// 로그아웃
  Future<void> logout() async {
    if (_accessToken != null && _refreshToken != null) {
      await _httpClient.post(
        Uri.parse('$_backendUrl/auth/logout'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_accessToken',
        },
        body: jsonEncode({'refreshToken': _refreshToken}),
      );
    }
    await googleSignIn.signOut();
    await _clearTokens();
  }

  Future<UserProfile?> fetchUserProfile() async {
    final token = await readAccessToken();
    if (token == null) return null;

    try {
      final response = await _httpClient
          .get(
            Uri.parse('$_backendUrl/auth/me'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return UserProfile.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );
      }
    } catch (_) {}
    return null;
  }

  Future<void> _saveTokens() async {
    if (_accessToken != null) {
      await _tokenStore.write(key: _keyAccessToken, value: _accessToken!);
    }
    if (_refreshToken != null) {
      await _tokenStore.write(key: _keyRefreshToken, value: _refreshToken!);
    }
  }

  Future<void> _clearTokens() async {
    await _tokenStore.delete(key: _keyAccessToken);
    await _tokenStore.delete(key: _keyRefreshToken);
    _accessToken = null;
    _refreshToken = null;
  }

  static Future<String?> readAccessToken() {
    return _defaultTokenStore.read(key: _keyAccessToken);
  }
}
