import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/shared/models/app_update_info.dart';

void main() {
  test('버전 문자열을 숫자 순서로 비교한다', () {
    expect(AppUpdateInfo.compareVersions('1.0.9', '1.0.8'), greaterThan(0));
    expect(AppUpdateInfo.compareVersions('1.0', '1.0.0'), 0);
    expect(AppUpdateInfo.compareVersions('1.0.7', '1.0.8'), lessThan(0));
  });

  test('최소 버전과 최신 버전을 구분한다', () {
    const info = AppUpdateInfo(
      latestVersion: '1.0.9',
      minimumVersion: '1.0.8',
      latestBuildNumber: 10,
      minimumBuildNumber: 9,
      forceUpdate: false,
      storeUrl: 'https://play.google.com',
      installedVersion: '1.0.8',
      installedBuildNumber: 9,
    );

    expect(info.requiresUpdate, isFalse);
    expect(info.hasUpdate, isTrue);
  });
}
