import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import '../features/podcast/main_screen.dart'; // 프로젝트 구조에 맞게 경로 확인 필수

class AudioHandler {
  static final AudioHandler instance = AudioHandler._internal();
  AudioHandler._internal();

  // 앱 전체에서 단 하나만 존재하는 플레이어
  final AudioPlayer player = AudioPlayer();
  String? currentEpisodeId;

  // 어디서든 호출 가능한 만능 재생 함수
  Future<void> playEpisode(PodcastEpisodeItem episode) async {
    try {
      currentEpisodeId = episode.id;

      // 1. 기존 재생 중단 및 초기화
      await player.stop();

      // 2. 백그라운드 재생 정보 설정
      final mediaItem = MediaItem(
        id: episode.id,
        title: episode.headline ?? episode.title,
        artist: 'AIPod',
        artUri: episode.thumbnailUrl != null ? Uri.tryParse(episode.thumbnailUrl!) : null,
      );

      // 3. 오디오 소스 설정 및 재생
      final source = AudioSource.uri(
        Uri.parse(episode.audioUrl ?? episode.streamUrl),
        tag: mediaItem,
      );

      await player.setAudioSource(source);
      player.play();
    } catch (e) {
      debugPrint('오디오 재생 실패: $e');
    }
  }
}