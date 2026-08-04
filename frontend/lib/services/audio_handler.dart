import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import '../core/app_config.dart';
import '../features/auth/auth_service.dart';
import '../features/podcast/main_screen.dart';

class AudioHandler {
  static final AudioHandler instance = AudioHandler._internal();
  AudioHandler._internal();

  final AudioPlayer player = AudioPlayer();
  final ValueNotifier<String?> currentEpisodeIdNotifier =
      ValueNotifier<String?>(null);
  int _playRequestVersion = 0;
  bool _playRequested = false;

  String? get currentEpisodeId => currentEpisodeIdNotifier.value;

  set currentEpisodeId(String? episodeId) {
    if (currentEpisodeIdNotifier.value == episodeId) return;
    currentEpisodeIdNotifier.value = episodeId;
  }

  Future<String?> playEpisode(PodcastEpisodeItem episode) async {
    final requestVersion = ++_playRequestVersion;
    _playRequested = true;
    currentEpisodeId = episode.id;

    try {
      await player.stop();

      final token = await AuthService.readAccessToken();
      final headers = token != null ? {'Authorization': 'Bearer $token'} : null;
      final source = AudioSource.uri(
        Uri.parse(episode.audioUrl ?? episode.streamUrl),
        headers: headers,
      );

      await player.setAudioSource(source);

      if (requestVersion != _playRequestVersion || !_playRequested) {
        return null;
      }

      await player.play();
      unawaited(_incrementPlayCount(episode.id));
      return null;
    } catch (e) {
      if (requestVersion == _playRequestVersion) {
        currentEpisodeId = null;
      }
      try {
        await player.stop();
      } catch (_) {}
      debugPrint('오디오 재생 실패: $e');
      return '오디오 재생 실패: $e';
    }
  }

  Future<void> pause() async {
    _playRequested = false;
    _playRequestVersion++;
    try {
      await player.pause();
    } catch (e) {
      debugPrint('오디오 일시정지 실패: $e');
    }
  }

  Future<void> resume() async {
    _playRequested = true;
    try {
      await player.play();
    } catch (e) {
      debugPrint('오디오 재생 재개 실패: $e');
    }
  }

  Future<void> _incrementPlayCount(String episodeId) async {
    try {
      final token = await AuthService.readAccessToken();
      if (token == null) return;

      await http.post(
        Uri.parse(
          '${AppConfig.apiBaseUrl}/episodes/$episodeId/audio-play-count',
        ),
        headers: {'Authorization': 'Bearer $token'},
      );
    } catch (e) {
      debugPrint('청취 기록 저장 실패: $e');
    }
  }
}
