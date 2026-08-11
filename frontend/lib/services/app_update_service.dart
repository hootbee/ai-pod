import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../core/app_config.dart';
import '../shared/models/app_update_info.dart';
import 'network_cache_service.dart';

class AppUpdateService {
  AppUpdateService._();

  static final AppUpdateService instance = AppUpdateService._();

  Future<AppUpdateInfo?> checkForUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final response = await NetworkCacheService.instance.dio.get<dynamic>(
        '${AppConfig.apiBaseUrl}/app-version',
      );
      final policy = response.data as Map<String, dynamic>;

      final info = AppUpdateInfo(
        latestVersion:
            policy['latestVersion'] as String? ?? packageInfo.version,
        minimumVersion:
            policy['minimumVersion'] as String? ?? packageInfo.version,
        latestBuildNumber: _parseInt(
          policy['latestBuildNumber'],
          packageInfo.buildNumber,
        ),
        minimumBuildNumber: _parseInt(policy['minimumBuildNumber'], '0'),
        forceUpdate: policy['forceUpdate'] as bool? ?? false,
        storeUrl: policy['storeUrl'] as String? ?? '',
        installedVersion: packageInfo.version,
        installedBuildNumber: int.tryParse(packageInfo.buildNumber) ?? 0,
      );

      return info.hasUpdate ? info : null;
    } on DioException {
      return null;
    } catch (_) {
      return null;
    }
  }

  int _parseInt(dynamic value, String fallback) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? int.tryParse(fallback) ?? 0;
  }
}
