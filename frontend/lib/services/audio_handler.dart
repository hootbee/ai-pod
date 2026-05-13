import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/app_config.dart';
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
      unawaited(_incrementPlayCount(episode.id));
    } catch (e) {
      debugPrint('오디오 재생 실패: $e');
    }
  }

  Future<void> _incrementPlayCount(String episodeId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
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
