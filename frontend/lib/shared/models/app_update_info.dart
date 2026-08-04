class AppUpdateInfo {
  final String latestVersion;
  final String minimumVersion;
  final int latestBuildNumber;
  final int minimumBuildNumber;
  final bool forceUpdate;
  final String storeUrl;
  final String installedVersion;
  final int installedBuildNumber;

  const AppUpdateInfo({
    required this.latestVersion,
    required this.minimumVersion,
    required this.latestBuildNumber,
    required this.minimumBuildNumber,
    required this.forceUpdate,
    required this.storeUrl,
    required this.installedVersion,
    required this.installedBuildNumber,
  });

  bool get requiresUpdate =>
      compareVersions(installedVersion, minimumVersion) < 0 ||
      installedBuildNumber < minimumBuildNumber;

  bool get hasUpdate =>
      compareVersions(installedVersion, latestVersion) < 0 ||
      installedBuildNumber < latestBuildNumber;

  static int compareVersions(String left, String right) {
    final leftParts = _parse(left);
    final rightParts = _parse(right);
    for (var index = 0; index < 3; index++) {
      final comparison = leftParts[index].compareTo(rightParts[index]);
      if (comparison != 0) return comparison;
    }
    return 0;
  }

  static List<int> _parse(String version) {
    final parts = version.split('.').map((part) => int.tryParse(part) ?? 0);
    final values = parts.take(3).toList();
    while (values.length < 3) {
      values.add(0);
    }
    return values;
  }
}
