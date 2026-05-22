import 'package:dio/dio.dart';

void configurePinnedTlsForApi(Dio dio, String apiBaseUrl) {
  // Web does not expose certificate APIs to Dart, so pinning is handled by browser TLS.
}
