import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/auth/auth_service.dart';
import 'package:http/http.dart' as http;

class _MemoryTokenStore implements AuthTokenStore {
  _MemoryTokenStore(
    this.tokens, {
    this.failDelete = false,
    this.failClear = false,
  });

  final Map<String, String> tokens;
  final bool failDelete;
  final bool failClear;

  @override
  Future<String?> read({required String key}) async => tokens[key];

  @override
  Future<void> write({required String key, required String value}) async {
    tokens[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    if (failDelete) throw StateError('token deletion failed');
    tokens.remove(key);
  }

  @override
  Future<void> clear() async {
    if (failClear) throw StateError('token store reset failed');
    tokens.clear();
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
      googleDisconnect: () async {},
      clearUserLocalData: () async {
        localDataCleanupCalls++;
      },
      clearAllLocalData: () async {},
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
      googleDisconnect: () async {},
      clearUserLocalData: () async {
        localDataCleanupCalls++;
      },
      clearAllLocalData: () async {},
    );

    expect(await service.tryAutoLogin(), isTrue);

    await expectLater(service.deleteAccount(), throwsException);
    expect(tokenStore.tokens['access_token'], 'access-token');
    expect(tokenStore.tokens['refresh_token'], 'refresh-token');
    expect(service.isLoggedIn, isTrue);
    expect(googleSignOutCalls, 0);
    expect(localDataCleanupCalls, 0);
  });

  test('기본 로컬 정리 실패 시 전체 인증 및 캐시 초기화를 시도한다', () async {
    final tokenStore = _MemoryTokenStore({
      'access_token': 'access-token',
      'refresh_token': 'refresh-token',
    }, failDelete: true);
    final client = _AccountDeletionClient(204);
    var googleDisconnectCalls = 0;
    var clearAllLocalDataCalls = 0;
    final service = AuthService(
      httpClient: client,
      tokenStore: tokenStore,
      backendUrl: 'https://api.example.com',
      googleSignOut: () async {
        throw StateError('sign-out failed');
      },
      googleDisconnect: () async {
        googleDisconnectCalls++;
      },
      clearUserLocalData: () async {
        throw StateError('user cache cleanup failed');
      },
      clearAllLocalData: () async {
        clearAllLocalDataCalls++;
      },
    );

    expect(await service.tryAutoLogin(), isTrue);
    await service.deleteAccount();

    expect(googleDisconnectCalls, 1);
    expect(clearAllLocalDataCalls, 1);
    expect(tokenStore.tokens, isEmpty);
    expect(service.isLoggedIn, isFalse);
  });

  test('전체 로컬 데이터 정리도 실패하면 전용 오류로 세션을 종료한다', () async {
    final tokenStore = _MemoryTokenStore(
      {'access_token': 'access-token', 'refresh_token': 'refresh-token'},
      failDelete: true,
      failClear: true,
    );
    final client = _AccountDeletionClient(204);
    final service = AuthService(
      httpClient: client,
      tokenStore: tokenStore,
      backendUrl: 'https://api.example.com',
      googleSignOut: () async {},
      googleDisconnect: () async {},
      clearUserLocalData: () async {
        throw StateError('user cache cleanup failed');
      },
      clearAllLocalData: () async {
        throw StateError('full cache reset failed');
      },
    );

    expect(await service.tryAutoLogin(), isTrue);

    await expectLater(
      service.deleteAccount(),
      throwsA(isA<AccountDeletionCleanupException>()),
    );
    expect(tokenStore.tokens['access_token'], 'access-token');
    expect(tokenStore.tokens['refresh_token'], 'refresh-token');
    expect(service.isLoggedIn, isFalse);
  });
}
