import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';

import 'package:frontend/features/auth/auth_service.dart';

class _MemoryTokenStore implements AuthTokenStore {
  final Map<String, String> _tokens = {};

  @override
  Future<String?> read({required String key}) async => _tokens[key];

  @override
  Future<void> write({required String key, required String value}) async {
    _tokens[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    _tokens.remove(key);
  }
}

class _AuthFlowClient extends http.BaseClient {
  _AuthFlowClient({required this.refreshSucceeds});

  final bool refreshSucceeds;
  final List<String> requestedPaths = [];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requestedPaths.add(request.url.path);

    if (request.url.path == '/auth/me') {
      return _response(401, '{"message":"expired"}', request);
    }

    if (request.url.path == '/auth/refresh') {
      if (refreshSucceeds) {
        return _response(
          200,
          '{"accessToken":"fresh-access","refreshToken":"fresh-refresh"}',
          request,
        );
      }
      return _response(401, '{"message":"refresh expired"}', request);
    }

    return _response(404, '{}', request);
  }

  http.StreamedResponse _response(
    int statusCode,
    String body,
    http.BaseRequest request,
  ) {
    return http.StreamedResponse(
      Stream.value(body.codeUnits),
      statusCode,
      request: request,
      headers: {'content-type': 'application/json'},
    );
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const stagingApiUrl = String.fromEnvironment('STAGING_API_URL');
  const stagingAccessToken = String.fromEnvironment('STAGING_ACCESS_TOKEN');
  const stagingRefreshToken = String.fromEnvironment('STAGING_REFRESH_TOKEN');

  testWidgets('401 응답 후 refresh 성공 시 새 토큰으로 세션을 유지한다', (tester) async {
    final tokenStore = _MemoryTokenStore();
    await tokenStore.write(key: 'access_token', value: 'expired-access');
    await tokenStore.write(key: 'refresh_token', value: 'valid-refresh');
    final client = _AuthFlowClient(refreshSucceeds: true);
    final service = AuthService(httpClient: client, tokenStore: tokenStore);

    expect(await service.tryAutoLogin(), isTrue);
    expect(client.requestedPaths, ['/auth/me', '/auth/refresh']);
    expect(await tokenStore.read(key: 'access_token'), 'fresh-access');
    expect(await tokenStore.read(key: 'refresh_token'), 'fresh-refresh');
  });

  testWidgets('refresh 실패 시 토큰을 삭제하고 세션을 종료한다', (tester) async {
    final tokenStore = _MemoryTokenStore();
    await tokenStore.write(key: 'access_token', value: 'expired-access');
    await tokenStore.write(key: 'refresh_token', value: 'expired-refresh');
    final client = _AuthFlowClient(refreshSucceeds: false);
    final service = AuthService(httpClient: client, tokenStore: tokenStore);

    expect(await service.tryAutoLogin(), isFalse);
    expect(client.requestedPaths, ['/auth/me', '/auth/refresh']);
    expect(await tokenStore.read(key: 'access_token'), isNull);
    expect(await tokenStore.read(key: 'refresh_token'), isNull);
  });

  testWidgets('staging API에서 만료 Access Token을 refresh한다', (tester) async {
    if (stagingApiUrl.isEmpty ||
        stagingAccessToken.isEmpty ||
        stagingRefreshToken.isEmpty) {
      markTestSkipped(
        'STAGING_API_URL, STAGING_ACCESS_TOKEN, STAGING_REFRESH_TOKEN are required',
      );
      return;
    }

    final tokenStore = _MemoryTokenStore();
    await tokenStore.write(key: 'access_token', value: stagingAccessToken);
    await tokenStore.write(key: 'refresh_token', value: stagingRefreshToken);
    final service = AuthService(
      backendUrl: stagingApiUrl,
      tokenStore: tokenStore,
    );

    expect(await service.tryAutoLogin(), isTrue);
    expect(
      await tokenStore.read(key: 'access_token'),
      isNot(stagingAccessToken),
    );
    expect(await tokenStore.read(key: 'refresh_token'), isNotNull);
  });
}
