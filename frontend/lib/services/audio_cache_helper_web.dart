import 'package:just_audio/just_audio.dart';

/// 웹: 파일 시스템 접근 불가 → URL 직접 재생 (캐싱 없음)
Future<AudioSource> buildCachedAudioSource(String url) async {
  return AudioSource.uri(Uri.parse(url));
}
