import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class AuthService {
  // 에뮬레이터: 'http://10.0.2.2:3000'  / 실기기: 'http://192.168.200.140:3000'
  static const String _backendUrl = 'http://10.0.2.2:3000';

  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';

  static final GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId:
        '711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com',
  );

  String? _accessToken;
  String? _refreshToken;

  String? get accessToken => _accessToken;
  bool get isLoggedIn => _accessToken != null;

  /// 앱 시작 시 저장된 토큰 로드 → 유효하면 true, 아니면 false
  Future<bool> tryAutoLogin() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString(_keyAccessToken);
    _refreshToken = prefs.getString(_keyRefreshToken);

    if (_accessToken == null) return false;

    // 토큰 유효성 검사 (GET /auth/me)
    try {
      final response = await http.get(
        Uri.parse('$_backendUrl/auth/me'),
        headers: {'Authorization': 'Bearer $_accessToken'},
      ).timeout(const Duration(seconds: 10));

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
    final account = await _googleSignIn.signIn();
    if (account == null) throw Exception('Google 로그인 취소됨');

    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null) throw Exception('ID Token 획득 실패');

    final response = await http.post(
      Uri.parse('$_backendUrl/auth/google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'idToken': idToken}),
    ).timeout(const Duration(seconds: 15));

    if (response.statusCode != 200) {
      throw Exception('백엔드 로그인 실패: ${response.body}');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    _accessToken = data['accessToken'] as String?;
    _refreshToken = data['refreshToken'] as String?;

    // 토큰 로컬 저장
    await _saveTokens();
    return data;
  }

  /// Access Token 갱신
  Future<void> _refresh() async {
    if (_refreshToken == null) throw Exception('로그인이 필요합니다');

    final response = await http.post(
      Uri.parse('$_backendUrl/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': _refreshToken}),
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode != 200) throw Exception('토큰 갱신 실패');

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
    await _googleSignIn.signOut();
    await _clearTokens();
  }

  Future<void> _saveTokens() async {
    final prefs = await SharedPreferences.getInstance();
    if (_accessToken != null) await prefs.setString(_keyAccessToken, _accessToken!);
    if (_refreshToken != null) await prefs.setString(_keyRefreshToken, _refreshToken!);
  }

  Future<void> _clearTokens() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyAccessToken);
    await prefs.remove(_keyRefreshToken);
    _accessToken = null;
    _refreshToken = null;
  }
}
