import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class AuthService {
  static const String _backendUrl = 'http://192.168.200.140:3000'; // Mac 실제 IP (실기기 테스트용)

  static final GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId:
        '711427859481-ishgmphcatvfecfio6pqat1tfnbc7rl7.apps.googleusercontent.com',
  );

  String? _accessToken;
  String? _refreshToken;

  String? get accessToken => _accessToken;
  bool get isLoggedIn => _accessToken != null;

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
    );

    if (response.statusCode != 200) {
      throw Exception('백엔드 로그인 실패: ${response.body}');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    _accessToken = data['accessToken'] as String?;
    _refreshToken = data['refreshToken'] as String?;
    return data;
  }

  /// 내 정보 조회
  Future<Map<String, dynamic>> getMe() async {
    if (_accessToken == null) throw Exception('로그인이 필요합니다');

    final response = await http.get(
      Uri.parse('$_backendUrl/auth/me'),
      headers: {'Authorization': 'Bearer $_accessToken'},
    );

    if (response.statusCode == 401) {
      await _refresh();
      return getMe();
    }

    if (response.statusCode != 200) {
      throw Exception('내 정보 조회 실패');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Access Token 갱신
  Future<void> _refresh() async {
    if (_refreshToken == null) throw Exception('로그인이 필요합니다');

    final response = await http.post(
      Uri.parse('$_backendUrl/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': _refreshToken}),
    );

    if (response.statusCode != 200) throw Exception('토큰 갱신 실패');

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    _accessToken = data['accessToken'] as String?;
    _refreshToken = data['refreshToken'] as String?;
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
    _accessToken = null;
    _refreshToken = null;
  }
}
