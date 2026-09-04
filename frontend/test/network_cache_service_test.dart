import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/services/network_cache_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('회원탈퇴 시 사용자 API 캐시만 삭제한다', () async {
    const userHistoryUri =
        'https://api.example.com/users/me/history?limit=10&offset=0';
    const episodesUri = 'https://api.example.com/episodes?limit=10&offset=0';
    SharedPreferences.setMockInitialValues({
      'etag:$userHistoryUri': 'user-etag',
      'cache:$userHistoryUri': '{"data":[]}',
      'etag:$episodesUri': 'episodes-etag',
      'cache:$episodesUri': '{"data":[]}',
      'unrelated': 'keep-me',
    });

    await NetworkCacheService.clearAuthenticatedUserData();

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey('etag:$userHistoryUri'), isFalse);
    expect(prefs.containsKey('cache:$userHistoryUri'), isFalse);
    expect(prefs.getString('etag:$episodesUri'), 'episodes-etag');
    expect(prefs.getString('cache:$episodesUri'), '{"data":[]}');
    expect(prefs.getString('unrelated'), 'keep-me');
  });
}
