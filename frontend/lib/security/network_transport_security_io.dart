import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';

const String _pinEnv = String.fromEnvironment('BACKEND_CERT_SHA256', defaultValue: '');

final Set<String> _verifiedHosts = <String>{};

void configurePinnedTlsForApi(Dio dio, String apiBaseUrl) {
  if (_pinEnv.trim().isEmpty) return;

  final apiUri = Uri.tryParse(apiBaseUrl);
  if (apiUri == null || apiUri.scheme != 'https' || apiUri.host.isEmpty) return;

  final pinned = _pinEnv
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .where((v) => v.isNotEmpty)
      .toSet();
  if (pinned.isEmpty) return;

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final uri = options.uri;
        if (uri.scheme == 'https' && uri.host == apiUri.host) {
          final key = '${uri.host}:${uri.port == 0 ? 443 : uri.port}';
          if (!_verifiedHosts.contains(key)) {
            await _verifyPinnedCertificate(
              host: uri.host,
              port: uri.hasPort ? uri.port : 443,
              pinnedFingerprints: pinned,
            );
            _verifiedHosts.add(key);
          }
        }
        handler.next(options);
      },
    ),
  );
}

Future<void> _verifyPinnedCertificate({
  required String host,
  required int port,
  required Set<String> pinnedFingerprints,
}) async {
  SecureSocket? socket;
  try {
    socket = await SecureSocket.connect(
      host,
      port,
      timeout: const Duration(seconds: 5),
      onBadCertificate: (_) => false,
    );
    final cert = socket.peerCertificate;
    if (cert == null) {
      throw const SocketException('No peer certificate');
    }
    final derHash = sha256.convert(cert.der).toString().toLowerCase();
    if (!pinnedFingerprints.contains(derHash)) {
      throw HandshakeException('Certificate pin mismatch for $host');
    }
  } finally {
    await socket?.close();
  }
}
