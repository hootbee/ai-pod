import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import '../features/podcast/main_screen.dart';

class AudioHandler {
  static final AudioHandler instance = AudioHandler._internal();
  AudioHandler._internal();

  final AudioPlayer player = AudioPlayer();
  String? currentEpisodeId;

  Future<void> playEpisode(PodcastEpisodeItem episode) async {
    try {
      currentEpisodeId = episode.id;
      await player.stop();

    //백그라운드 재생 시 뜨는 정보
      final mediaItem = MediaItem(
        id: episode.id,
        title: episode.headline ?? episode.title,
        artist: 'AIPod',
        artUri: episode.thumbnailUrl != null ? Uri.tryParse(episode.thumbnailUrl!) : null,
      );

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