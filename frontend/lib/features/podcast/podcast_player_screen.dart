import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'main_screen.dart';

class PodcastPlayerScreen extends StatefulWidget {
  final PodcastEpisodeItem episode;

  const PodcastPlayerScreen({super.key, required this.episode});

  @override
  State<PodcastPlayerScreen> createState() => _PodcastPlayerScreenState();
}

class _PodcastPlayerScreenState extends State<PodcastPlayerScreen> {
  late AudioPlayer _audioPlayer;
  String? _audioError;
  bool _audioReady = false;
  bool _audioInitializing = false;

  List<String> get _transcript => widget.episode.script
      .split('\n')
      .map(_sanitizeTranscriptLine)
      .where((line) => line.isNotEmpty)
      .toList();

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
    _audioPlayer = AudioPlayer();
    _initAudio();
  }

  Future<void> _initAudio() async {
    if (_audioInitializing) return;
    _audioInitializing = true;

    try {
      final candidates = <String>{};
      final rawCandidates = <String>[
        widget.episode.streamUrl,
        if (widget.episode.audioUrl != null &&
            widget.episode.audioUrl!.isNotEmpty)
          widget.episode.audioUrl!,
      ];

      for (final raw in rawCandidates) {
        final normalized = raw.replaceAll(RegExp(r'\s+'), '').trim();
        if (normalized.isEmpty) continue;
        candidates.add(normalized);

        for (final alternate in _alternateStreamUrls(normalized)) {
          candidates.add(alternate);
        }

        final hinted = _appendExtHintIfMissing(normalized);
        candidates.add(hinted);
      }

      Object? lastError;
      for (final url in candidates) {
        try {
          await _audioPlayer.setUrl(url);
          if (!mounted) return;
          setState(() {
            _audioReady = true;
            _audioError = null;
          });
          return;
        } catch (e) {
          lastError = e;
          await _audioPlayer.dispose();
          _audioPlayer = AudioPlayer();
        }
      }

      if (!mounted) return;
      setState(() {
        _audioReady = false;
        _audioError =
            '오디오 연결 실패 (${candidates.join(" | ")}): ${lastError ?? "unknown"}';
      });
    } finally {
      _audioInitializing = false;
    }
  }

  String _appendExtHintIfMissing(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return url;
    final path = uri.path.toLowerCase();
    final hasKnownExt =
        path.endsWith('.mp3') ||
        path.endsWith('.m4a') ||
        path.endsWith('.wav') ||
        path.endsWith('.aac');
    if (hasKnownExt || uri.queryParameters.containsKey('ext')) return url;

    final query = Map<String, String>.from(uri.queryParameters);
    query['ext'] = '.mp3';
    return uri.replace(queryParameters: query).toString();
  }

  Iterable<String> _alternateStreamUrls(String url) sync* {
    final uri = Uri.tryParse(url);
    if (uri == null) return;

    final path = uri.path;
    if (path.endsWith('.m4a')) {
      yield uri
          .replace(path: path.substring(0, path.length - 4) + '.mp3')
          .toString();
      return;
    }

    if (path.endsWith('.mp3')) {
      yield uri
          .replace(path: path.substring(0, path.length - 4) + '.m4a')
          .toString();
    }
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
      await _audioPlayer.play();
    }
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
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
              widget.episode.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 18),
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.ios_share, color: Colors.white),
            onPressed: () {},
          ),
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
              child: ListView.separated(
                itemCount: _transcript.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 16),
                itemBuilder: (context, index) {
                  return Text(
                    _transcript[index],
                    style: TextStyle(
                      fontSize: 20,
                      height: 1.5,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withOpacity(0.8),
                    ),
                  );
                },
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.only(bottom: 50.0, top: 20.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                IconButton(
                  icon: const Icon(Icons.speed, color: Colors.white70),
                  onPressed: () {},
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
                  icon: const Icon(Icons.nights_stay, color: Colors.white70),
                  onPressed: () {},
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
