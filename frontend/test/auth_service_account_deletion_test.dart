import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/auth/auth_service.dart';
import 'package:http/http.dart' as http;

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
  Future<void> delete({required String key}) async {
    tokens.remove(key);
  }
}

class _AccountDeletionClient extends http.BaseClient {
  _AccountDeletionClient(this.deleteStatusCode);

  final int deleteStatusCode;
  final List<http.BaseRequest> requests = [];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    if (request.method == 'GET' && request.url.path == '/auth/me') {
      return http.StreamedResponse(Stream.value(const <int>[]), 200);
    }
    if (request.method == 'DELETE' && request.url.path == '/users/me') {
      return http.StreamedResponse(
        Stream.value(const <int>[]),
        deleteStatusCode,
      );
    }
    return http.StreamedResponse(Stream.value(const <int>[]), 404);
  }
}

void main() {
  test('DELETE /users/me 성공 시 인증 정보와 사용자 로컬 데이터를 정리한다', () async {
    final tokenStore = _MemoryTokenStore({
      'access_token': 'access-token',
      'refresh_token': 'refresh-token',
    });
    final client = _AccountDeletionClient(204);
    var googleSignOutCalls = 0;
    var localDataCleanupCalls = 0;
    final service = AuthService(
      httpClient: client,
      tokenStore: tokenStore,
      backendUrl: 'https://api.example.com',
      googleSignOut: () async {
        googleSignOutCalls++;
      },
      clearUserLocalData: () async {
        localDataCleanupCalls++;
      },
    );

    expect(await service.tryAutoLogin(), isTrue);
    await service.deleteAccount();

    final deleteRequest = client.requests.singleWhere(
      (request) => request.method == 'DELETE',
    );
    expect(deleteRequest.url.path, '/users/me');
    expect(deleteRequest.headers['Authorization'], 'Bearer access-token');
    expect(tokenStore.tokens, isEmpty);
    expect(service.isLoggedIn, isFalse);
    expect(googleSignOutCalls, 1);
    expect(localDataCleanupCalls, 1);
  });

  test('회원탈퇴 API 실패 시 인증 정보와 사용자 로컬 데이터를 유지한다', () async {
    final tokenStore = _MemoryTokenStore({
      'access_token': 'access-token',
      'refresh_token': 'refresh-token',
    });
    final client = _AccountDeletionClient(500);
    var googleSignOutCalls = 0;
    var localDataCleanupCalls = 0;
    final service = AuthService(
      httpClient: client,
      tokenStore: tokenStore,
      backendUrl: 'https://api.example.com',
      googleSignOut: () async {
        googleSignOutCalls++;
      },
      clearUserLocalData: () async {
        localDataCleanupCalls++;
      },
    );

    expect(await service.tryAutoLogin(), isTrue);

    await expectLater(service.deleteAccount(), throwsException);
    expect(tokenStore.tokens['access_token'], 'access-token');
    expect(tokenStore.tokens['refresh_token'], 'refresh-token');
    expect(service.isLoggedIn, isTrue);
    expect(googleSignOutCalls, 0);
    expect(localDataCleanupCalls, 0);
  });
}
