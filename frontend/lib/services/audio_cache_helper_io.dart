import 'dart:io';

import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';

/// 모바일/데스크톱: 스트리밍과 동시에 로컬 파일로 저장 (하이브리드 캐싱)
///
/// - 첫 재생: 서버 Range 스트리밍하며 동시에 로컬에 저장
/// - 이후 재생: LockCachingAudioSource가 로컬 캐시를 자동 감지 → 서버 요청 없음
/// - [headers]: JWT 인증 등 커스텀 헤더 (스트림 엔드포인트가 JWT 가드 적용 시 필수)
Future<AudioSource> buildCachedAudioSource(
  String url, {
  Map<String, String>? headers,
  Object? tag,
}) async {
  final dir = await getTemporaryDirectory();
  final hash = url.hashCode.abs().toRadixString(36);
  final rawName = url.split('/').last.split('?').first;
  final ext = rawName.contains('.') ? rawName.split('.').last.toLowerCase() : 'mp3';
  final safeExt = {'mp3', 'm4a', 'aac', 'wav'}.contains(ext) ? ext : 'mp3';
  final cacheFile = File('${dir.path}/aipod_audio/$hash.$safeExt');
  await cacheFile.parent.create(recursive: true);

  // Required for local caching; just_audio currently marks this API experimental.
  // ignore: experimental_member_use
  return LockCachingAudioSource(
    Uri.parse(url),
    headers: headers,
    cacheFile: cacheFile,
    tag: tag,
  );
}
