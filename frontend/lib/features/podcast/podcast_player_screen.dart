import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:frontend/services/audio_handler.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import '../../core/app_config.dart';
import '../../services/network_cache_service.dart';
import '../../shared/widgets/source_info_bottom_sheet.dart';
import 'main_screen.dart';
import 'package:share_plus/share_plus.dart';

class PodcastPlayerScreen extends StatefulWidget {
  final PodcastEpisodeItem episode;

  const PodcastPlayerScreen({super.key, required this.episode});

  @override
  State<PodcastPlayerScreen> createState() => _PodcastPlayerScreenState();
}

class _PodcastPlayerScreenState extends State<PodcastPlayerScreen> {
  static const List<double> _playbackSpeeds = [1.0, 1.2, 1.5, 2.0];

  double _playbackSpeed = 1.0;
  bool _playCountIncremented = false;

  late AudioPlayer _audioPlayer;
  StreamSubscription<Duration>? _positionSubscription;
  String? _audioError;
  bool _audioReady = false;
  String _formatDuration(Duration? duration) {
    if (duration == null) return "00:00";
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return "$minutes:$seconds";
  }

  bool _audioInitializing = false;
  bool _subtitleCuesLoading = false;
  List<SubtitleCue> _subtitleCues = [];
  int _currentCueIndex = -1;
  final ItemScrollController _itemScrollController = ItemScrollController();
  final ItemPositionsListener _itemPositionsListener =
      ItemPositionsListener.create();

  List<String> get _transcript => widget.episode.script
      .split('\n')
      .map(_sanitizeTranscriptLine)
      .where((line) => line.isNotEmpty)
      .toList();

  List<String> get _displayLines => _subtitleCues.isNotEmpty
      ? _subtitleCues.map((cue) => cue.text).toList()
      : _transcript;

  String get _screenTitle {
    final createdAt = widget.episode.createdAt;
    if (createdAt == null) return widget.episode.title;
    return '${createdAt.year}년 ${createdAt.month}월 ${createdAt.day}일 뉴스';
  }

  String _sanitizeTranscriptLine(String rawLine) {
    var line = rawLine.replaceFirst(RegExp(r'^narrator:\s*'), '').trim();
    if (line == '---TOPIC_CHANGE---') return '';

    // HTML entity를 먼저 복원한 뒤 SSML/HTML 태그 제거
    line = line
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&');
    line = line.replaceAll(RegExp(r'<[^>]+>'), ' ');

    return line.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  @override
  void initState() {
    super.initState();
    _audioPlayer = AudioHandler.instance.player;
  
    _positionSubscription = _audioPlayer.positionStream.listen(
      _handlePlaybackPositionChanged,
    );
    _loadSubtitleCues();

    final bool isPlaying = _audioPlayer.playing;
    final bool isSameEpisode = AudioHandler.instance.currentEpisodeId == widget.episode.id;

  if (isSameEpisode && isPlaying) {
    setState(() {
      _audioReady = true;
    }); 
  } else {
    AudioHandler.instance.playEpisode(widget.episode).then((_) {
        if (mounted) setState(() => _audioReady = true);
      });
  }
}

  Future<void> _loadSubtitleCues() async {
    final subtitleCuesUrl = widget.episode.subtitleCuesUrl;
    if (subtitleCuesUrl == null || subtitleCuesUrl.isEmpty) return;

    setState(() {
      _subtitleCuesLoading = true;
    });

    try {
      final response = await NetworkCacheService.instance.dio
          .get<Map<String, dynamic>>(subtitleCuesUrl);

      final decoded = response.data ?? {};
      final cues = (decoded['cues'] as List<dynamic>? ?? const [])
          .map((item) => SubtitleCue.fromJson(item as Map<String, dynamic>))
          .where((cue) => cue.text.isNotEmpty)
          .toList();

      if (!mounted) return;
      setState(() {
        _subtitleCues = cues;
        _subtitleCuesLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _subtitleCuesLoading = false;
      });
    }
  }

  Future<void> _initAudio({int maxRetries = 3}) async {
    if (_audioInitializing) return;
    _audioInitializing = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      final headers = token != null ? {'Authorization': 'Bearer $token'} : null;

      final String targetUrl =
          widget.episode.audioUrl ?? widget.episode.streamUrl;
      final Object? mediaTag = kIsWeb
          ? null
          : MediaItem(
              id: widget.episode.id,
              title: widget.episode.headline ?? widget.episode.title,
              artist: 'AIPod',
              artUri: widget.episode.thumbnailUrl != null
                  ? Uri.tryParse(widget.episode.thumbnailUrl!)
                  : null,
            );

      Object? lastError;
      for (int attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await _audioPlayer.stop();
          final source = await NetworkCacheService.instance
              .getCachedAudioSource(targetUrl, headers: headers, tag: mediaTag);
          await _audioPlayer.setAudioSource(source, preload: true);

          AudioHandler.instance.currentEpisodeId = widget.episode.id;

          if (!mounted) return;
          setState(() {
            _audioReady = true; 
            _audioError = null;
          });
          return;
        } catch (e) {
          lastError = e;
          if (attempt < maxRetries) {
            await Future<void>.delayed(const Duration(seconds: 2));
            if (!mounted) return;
          }
        }
      }

      if (!mounted) return;
      setState(() {
        _audioReady = false;
        _audioError = '오디오 연결 실패: $lastError';
      });
    } finally {
      _audioInitializing = false;
    }
  }

  void _showPlaybackSpeedSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF2A2D24),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: _playbackSpeeds.map((speed) {
              final isSelected = speed == _playbackSpeed;
              return ListTile(
                title: Text(
                  '${speed.toStringAsFixed(1)}x',
                  style: TextStyle(
                    color: isSelected
                        ? const Color(0xFFD6E36F)
                        : Colors.white,
                    fontWeight: isSelected
                        ? FontWeight.w700
                        : FontWeight.w400,
                    fontSize: 18,
                  ),
                ),
                trailing: isSelected
                    ? const Icon(Icons.check, color: Color(0xFFD6E36F))
                    : null,
                onTap: () async {
                  final navigator = Navigator.of(context);
                  await _audioPlayer.setSpeed(speed);
                  setState(() {
                    _playbackSpeed = speed;
                  });
                  if (mounted) navigator.pop();
                },
              );
            }).toList(),
          ),
        );
      },
    );
  }

  Future<void> _seekRelative(int deltaSeconds) async {
    if (!_audioReady) return;
    final position = _audioPlayer.position;
    final duration = _audioPlayer.duration;
    var target = position.inSeconds + deltaSeconds;
    if (target < 0) target = 0;
    if (duration != null && target > duration.inSeconds) {
      target = duration.inSeconds;
    }
    await _audioPlayer.seek(Duration(seconds: target));
  }

  Future<void> _togglePlayPause(bool playing) async {
    if (!_audioReady) {
      await _initAudio();
      if (!_audioReady) return;
    }
    if (playing) {
      await _audioPlayer.pause();
    } else {
      if (!_playCountIncremented) {
        _playCountIncremented = true;
        SharedPreferences.getInstance().then((prefs) {
          final token = prefs.getString('access_token');
          if (token == null) return;
          http.post(
            Uri.parse('${AppConfig.apiBaseUrl}/episodes/${widget.episode.id}/audio-play-count'),
            headers: {'Authorization': 'Bearer $token'},
          ).ignore();
        });
      }
      await _audioPlayer.play();
    }
  }

  void _handlePlaybackPositionChanged(Duration position) {
    if (_subtitleCues.isEmpty) return;

    final positionMs = position.inMilliseconds;
    final cueIndex = _subtitleCues.indexWhere(
      (cue) => positionMs >= cue.startMs && positionMs < cue.endMs,
    );

    if (cueIndex == -1 || cueIndex == _currentCueIndex) return;
    if (!mounted) return;

    setState(() {
      _currentCueIndex = cueIndex;
    });

    if (_itemScrollController.isAttached && !_isCueComfortablyVisible(cueIndex)) {
      _itemScrollController.scrollTo(
        index: cueIndex,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeInOut,
        alignment: 0.18,
      );
    }
  }

  bool _isCueComfortablyVisible(int cueIndex) {
    final positions = _itemPositionsListener.itemPositions.value;
    if (positions.isEmpty) return false;

    for (final itemPosition in positions) {
      if (itemPosition.index != cueIndex) continue;

      final isAboveViewport = itemPosition.itemTrailingEdge <= 0.12;
      final isBelowViewport = itemPosition.itemLeadingEdge >= 0.82;
      return !(isAboveViewport || isBelowViewport);
    }

    return false;
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E211A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('', style: TextStyle(color: Colors.white)),
        titleTextStyle: const TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
        centerTitle: false,
        titleSpacing: 0,
        flexibleSpace: SafeArea(
          child: Padding(
            padding: const EdgeInsets.only(left: 56, right: 16, top: 12),
            child: Text(
              _screenTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 18),
            ),
          ),
        ),
        actions: [
          /*if (widget.episode.sources.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.link, color: Colors.white),
              tooltip: '원문 출처',
              onPressed: () => showSourceInfoBottomSheet(
                context,
                sources: widget.episode.sources,
                thumbnailUrl: widget.episode.thumbnailUrl,
              ),
            ),*/
          IconButton(
            icon: const Icon(Icons.ios_share, color: Colors.white),
            onPressed: () {
              final String shareText = '[aipod] ${widget.episode.title}\n\n지금 이 에피소드를 들어보세요!\n\n${widget.episode.streamUrl}';
              SharePlus.instance.share(ShareParams(text: shareText, subject: widget.episode.title));
            },
          ),
          const SizedBox(width: 5),
        ],
      ),
      body: Column(
        children: [
          if (_audioError != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                _audioError!,
                style: const TextStyle(color: Colors.redAccent),
              ),
            ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 24.0,
                vertical: 16.0,
              ),
              child: ScrollablePositionedList.separated(
                itemScrollController: _itemScrollController,
                itemPositionsListener: _itemPositionsListener,
                itemCount: _displayLines.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 16),
                itemBuilder: (context, index) {
                  final isActive = index == _currentCueIndex;
                  return Text(
                    _displayLines[index],
                    style: TextStyle(
                      fontSize: 20,
                      height: 1.5,
                      fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                      color: isActive
                          ? const Color(0xFFD6E36F)
                          : Colors.white.withValues(alpha: 0.8),
                    ),
                  );
                },
              ),
            ),
          ),

          if (_subtitleCuesLoading)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                '자막 싱크 로딩 중...',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.65),
                  fontSize: 13,
                ),
              ),
            ),

            StreamBuilder<Duration?>(
            stream: _audioPlayer.positionStream,
            builder: (context, snapshot) {
              final position = snapshot.data ?? Duration.zero;
              final duration = _audioPlayer.duration ?? Duration.zero;

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40.0),
                child: Column(
                  children: [
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 10.5,
                        trackShape: const RoundedRectSliderTrackShape(),
                        thumbShape: SliderComponentShape.noThumb,
                        overlayShape: SliderComponentShape.noOverlay,
                        activeTrackColor: const Color(0xFF4F7C2D),
                        inactiveTrackColor: const Color(0xFF344D1C),
                      ),
                      child: Slider(
                        min: 0.0,
                        max: duration.inMilliseconds.toDouble(),
                        value: position.inMilliseconds.toDouble().clamp(0.0, duration.inMilliseconds.toDouble()),
                        onChanged: (value) {
                          _audioPlayer.seek(Duration(milliseconds: value.toInt()));
                        },
                      ),
                    ),
                    const SizedBox(height: 7),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_formatDuration(position), style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500)),
                          Text(_formatDuration(duration), style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),

          Padding(
            padding: const EdgeInsets.only(bottom: 50.0, top: 20.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                IconButton(
                  icon: const Icon(Icons.speed, color: Colors.white70),
                  onPressed: _showPlaybackSpeedSheet,
                ),
                IconButton(
                  icon: const Icon(
                    Icons.replay_10,
                    color: Colors.white,
                    size: 36,
                  ),
                  onPressed: () => _seekRelative(-10),
                ),
                StreamBuilder<PlayerState>(
                  stream: _audioPlayer.playerStateStream,
                  builder: (context, snapshot) {
                    final playing = snapshot.data?.playing ?? false;
                    return IconButton(
                      icon: Icon(
                        playing
                            ? Icons.pause_circle_filled
                            : Icons.play_circle_fill,
                      ),
                      iconSize: 64,
                      color: Colors.white,
                      onPressed: () => _togglePlayPause(playing),
                    );
                  },
                ),
                IconButton(
                  icon: const Icon(
                    Icons.forward_10,
                    color: Colors.white,
                    size: 36,
                  ),
                  onPressed: () => _seekRelative(10),
                ),
                IconButton(
                  icon: Icon(
                    Icons.link, 
                    color: widget.episode.sources.isNotEmpty ? Colors.white70 : Colors.white24,
                  ),
                  onPressed: widget.episode.sources.isNotEmpty 
                    ? () => showSourceInfoBottomSheet(
                        context,
                        sources: widget.episode.sources,
                        thumbnailUrl: widget.episode.thumbnailUrl,
                      )
                    : null,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Text(
              '현재 재생 속도 ${_playbackSpeed.toStringAsFixed(1)}x',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.7),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class SubtitleCue {
  final int index;
  final String text;
  final int startMs;
  final int endMs;
  final bool isTopicChange;

  const SubtitleCue({
    required this.index,
    required this.text,
    required this.startMs,
    required this.endMs,
    required this.isTopicChange,
  });

  factory SubtitleCue.fromJson(Map<String, dynamic> json) {
    return SubtitleCue(
      index: json['index'] as int? ?? 0,
      text: json['text'] as String? ?? '',
      startMs: json['startMs'] as int? ?? 0,
      endMs: json['endMs'] as int? ?? 0,
      isTopicChange: json['isTopicChange'] as bool? ?? false,
    );
  }
}
