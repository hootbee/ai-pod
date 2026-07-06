import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import '../core/app_config.dart';
import '../features/auth/auth_service.dart';
import '../features/podcast/main_screen.dart';

class AudioHandler {
  static final AudioHandler instance = AudioHandler._internal();
  AudioHandler._internal();

  final AudioPlayer player = AudioPlayer();
  String? currentEpisodeId;

  Future<String?> playEpisode(PodcastEpisodeItem episode) async {
    try {
      await player.stop();

      // 백그라운드 재생 시 뜨는 정보
      final mediaItem = MediaItem(
        id: episode.id,
        title: episode.headline ?? episode.title,
        artist: 'AIPod',
        artUri: episode.thumbnailUrl != null ? Uri.tryParse(episode.thumbnailUrl!) : null,
      );

      final token = await AuthService.readAccessToken();
      final headers = token != null ? {'Authorization': 'Bearer $token'} : null;
      final source = AudioSource.uri(
        Uri.parse(episode.audioUrl ?? episode.streamUrl),
        headers: headers,
        tag: mediaItem,
      );

      await player.setAudioSource(source);
      await player.play();
      currentEpisodeId = episode.id;
      unawaited(_incrementPlayCount(episode.id));
      return null;
    } catch (e) {
      currentEpisodeId = null;
      try {
        await player.stop();
      } catch (_) {}
      debugPrint('오디오 재생 실패: $e');
      return '오디오 재생 실패: $e';
    }
  }

  Future<void> _incrementPlayCount(String episodeId) async {
    try {
      final token = await AuthService.readAccessToken();
      if (token == null) return;

      await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/episodes/$episodeId/audio-play-count'),
        headers: {'Authorization': 'Bearer $token'},
      );
    } catch (e) {
      debugPrint('청취 기록 저장 실패: $e');
    }
  }
}
