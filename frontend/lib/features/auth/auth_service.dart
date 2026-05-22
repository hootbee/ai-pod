import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../core/app_config.dart';
import '../../shared/models/user_profile.dart';

class AuthService {
  // URL은 AppConfig에서 환경별로 자동 결정됨
  static String get _backendUrl => AppConfig.apiBaseUrl;
  static const _googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue: '',
  );

  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();

  static final GoogleSignIn googleSignIn = kIsWeb
      ? GoogleSignIn(clientId: _googleClientId)
      : GoogleSignIn(serverClientId: _googleClientId);

  String? _accessToken;
  String? _refreshToken;

  String? get accessToken => _accessToken;
  bool get isLoggedIn => _accessToken != null;

  /// 앱 시작 시 저장된 토큰 로드 → 유효하면 true, 아니면 false
  Future<bool> tryAutoLogin() async {
    _accessToken = await _secureStorage.read(key: _keyAccessToken);
    _refreshToken = await _secureStorage.read(key: _keyRefreshToken);

    if (_accessToken == null) return false;

    // 토큰 유효성 검사 (GET /auth/me)
    try {
      final response = await http
          .get(
            Uri.parse('$_backendUrl/auth/me'),
            headers: {'Authorization': 'Bearer $_accessToken'},
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) return true;

      // Access token 만료 → refresh 시도
      if (response.statusCode == 401 && _refreshToken != null) {
        await _refresh();
        return true;
      }
    } catch (_) {}

    // 실패 시 저장된 토큰 삭제
    await _clearTokens();
    return false;
  }

  /// Google 로그인 + 백엔드 JWT 발급
  Future<Map<String, dynamic>> loginWithGoogle() async {
    if (_googleClientId.isEmpty) {
      throw StateError('GOOGLE_CLIENT_ID is required. Pass with --dart-define=GOOGLE_CLIENT_ID=...');
    }

    final account = await googleSignIn.signIn();
    if (account == null) throw Exception('Google 로그인이 취소되었습니다.');

    final auth = await account.authentication;
    final idToken = auth.idToken;
    final accessToken = auth.accessToken;
    if (idToken == null && accessToken == null) {
      throw Exception(_genericAuthError);
    }

    final payload = <String, String>{};
    if (idToken != null) payload['idToken'] = idToken;
    if (accessToken != null) payload['accessToken'] = accessToken;

    final response = await http
        .post(
          Uri.parse('$_backendUrl/auth/google'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 15));

    if (response.statusCode != 200) throw Exception(_genericAuthError);

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    _accessToken = data['accessToken'] as String?;
    _refreshToken = data['refreshToken'] as String?;

    // 토큰 로컬 저장
    await _saveTokens();
    return data;
  }

  /// Access Token 갱신
  Future<void> _refresh() async {
    if (_refreshToken == null) throw Exception('로그인이 필요합니다.');

    final response = await http
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
      await http.post(
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
      final response = await http
          .get(
            Uri.parse('$_backendUrl/auth/me'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return UserProfile.fromJson(
            jsonDecode(response.body) as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  Future<void> _saveTokens() async {
    if (_accessToken != null) {
      await _secureStorage.write(key: _keyAccessToken, value: _accessToken!);
    }
    if (_refreshToken != null) {
      await _secureStorage.write(key: _keyRefreshToken, value: _refreshToken!);
    }
  }

  Future<void> _clearTokens() async {
    await _secureStorage.delete(key: _keyAccessToken);
    await _secureStorage.delete(key: _keyRefreshToken);
    _accessToken = null;
    _refreshToken = null;
  }

  static Future<String?> readAccessToken() {
    return _secureStorage.read(key: _keyAccessToken);
  }
}
  static const String _genericAuthError = '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
