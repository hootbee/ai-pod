import 'dart:io';

import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';

/// 모바일/데스크톱: 스트리밍과 동시에 로컬 파일로 저장
Future<AudioSource> buildCachedAudioSource(String url) async {
  final dir = await getTemporaryDirectory();
  final hash = url.hashCode.abs().toRadixString(36);
  final rawName = url.split('/').last.split('?').first;
  final ext = rawName.contains('.') ? rawName.split('.').last.toLowerCase() : 'mp3';
  final safeExt = {'mp3', 'm4a', 'aac', 'wav'}.contains(ext) ? ext : 'mp3';
  final cacheFile = File('${dir.path}/aipod_audio/$hash.$safeExt');
  await cacheFile.parent.create(recursive: true);

  return LockCachingAudioSource(Uri.parse(url), cacheFile: cacheFile);
}
