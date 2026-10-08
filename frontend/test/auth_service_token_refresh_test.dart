import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/auth/auth_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class _MemoryTokenStore implements AuthTokenStore {
  _MemoryTokenStore(this.tokens);

  final Map<String, String> tokens;

  @override
  Future<String?> read({required String key}) async => tokens[key];

  @override
  Future<void> write({required String key, required String value}) async {
    tokens[key] = value;
  }

  @override
  Future<void> delete({required String key}) async => tokens.remove(key);

  @override
  Future<void> clear() async => tokens.clear();
}

String _jwtExpiringIn(Duration duration) {
  final exp = DateTime.now().add(duration).millisecondsSinceEpoch ~/ 1000;
  final payload = base64Url
      .encode(utf8.encode(jsonEncode({'sub': 'user', 'exp': exp})))
      .replaceAll('=', '');
  return 'header.$payload.signature';
}

void main() {
  test('유효한 access token은 refresh 없이 그대로 반환한다', () async {
    final token = _jwtExpiringIn(const Duration(minutes: 30));
    var refreshCalls = 0;
    final service = AuthService(
      tokenStore: _MemoryTokenStore({
        'access_token': token,
        'refresh_token': 'refresh-old',
      }),
      backendUrl: 'https://api.test',
      httpClient: MockClient((_) async {
        refreshCalls++;
        return http.Response('', 500);
      }),
    );

    expect(await service.readValidAccessToken(), token);
    expect(refreshCalls, 0);
  });

  test('만료된 access token은 한 번만 refresh하고 새 토큰을 저장한다', () async {
    final store = _MemoryTokenStore({
      'access_token': _jwtExpiringIn(const Duration(minutes: -5)),
      'refresh_token': 'refresh-old',
    });
    var refreshCalls = 0;
    AuthService newService() => AuthService(
      tokenStore: store,
      backendUrl: 'https://api.test',
      httpClient: MockClient((request) async {
        expect(request.url.path, '/auth/refresh');
        expect(jsonDecode(request.body)['refreshToken'], 'refresh-old');
        refreshCalls++;
        return http.Response(
          jsonEncode({
            'accessToken': 'access-new',
            'refreshToken': 'refresh-new',
          }),
          200,
        );
      }),
    );

    // 화면마다 AuthService를 새로 만들므로 인스턴스가 달라도 refresh는 한 번이어야 한다.
    final results = await Future.wait([
      newService().readValidAccessToken(),
      newService().readValidAccessToken(),
    ]);

    expect(results, ['access-new', 'access-new']);
    expect(refreshCalls, 1);
    expect(store.tokens['access_token'], 'access-new');
    expect(store.tokens['refresh_token'], 'refresh-new');
  });

  test('일시적인 refresh 실패 시 토큰을 지우지 않고 기존 토큰을 반환한다', () async {
    final expired = _jwtExpiringIn(const Duration(minutes: -5));
    final store = _MemoryTokenStore({
      'access_token': expired,
      'refresh_token': 'refresh-old',
    });
    final service = AuthService(
      tokenStore: store,
      backendUrl: 'https://api.test',
      httpClient: MockClient((_) async => http.Response('', 503)),
    );

    expect(await service.readValidAccessToken(), expired);
    expect(store.tokens['access_token'], expired);
    expect(store.tokens['refresh_token'], 'refresh-old');
  });

  test('서버가 refresh token을 거부하면 세션을 정리하고 null을 반환한다', () async {
    final store = _MemoryTokenStore({
      'access_token': _jwtExpiringIn(const Duration(minutes: -5)),
      'refresh_token': 'refresh-revoked',
    });
    final service = AuthService(
      tokenStore: store,
      backendUrl: 'https://api.test',
      httpClient: MockClient((_) async => http.Response('', 401)),
    );

    expect(await service.readValidAccessToken(), isNull);
    expect(store.tokens, isEmpty);
  });

  test('JWT 형식이 아닌 토큰은 refresh 없이 그대로 반환한다', () async {
    var refreshCalls = 0;
    final service = AuthService(
      tokenStore: _MemoryTokenStore({'access_token': 'opaque-token'}),
      backendUrl: 'https://api.test',
      httpClient: MockClient((_) async {
        refreshCalls++;
        return http.Response('', 500);
      }),
    );

    expect(await service.readValidAccessToken(), 'opaque-token');
    expect(refreshCalls, 0);
  });

  test('refresh 도중 로그아웃하면 refresh가 끝난 뒤 토큰을 지운다', () async {
    final store = _MemoryTokenStore({
      'access_token': _jwtExpiringIn(const Duration(minutes: -5)),
      'refresh_token': 'refresh-old',
    });
    final refreshResponse = Completer<http.Response>();
    final client = MockClient((request) {
      if (request.url.path == '/auth/refresh') return refreshResponse.future;
      return Future.value(http.Response('', 200));
    });
    AuthService newService() => AuthService(
      tokenStore: store,
      backendUrl: 'https://api.test',
      httpClient: client,
      googleSignOut: () async {},
    );

    final read = newService().readValidAccessToken();
    final logout = newService().logout();
    refreshResponse.complete(
      http.Response(
        jsonEncode({
          'accessToken': 'access-new',
          'refreshToken': 'refresh-new',
        }),
        200,
      ),
    );
    await read;
    await logout;

    expect(store.tokens, isEmpty);
  });
}
