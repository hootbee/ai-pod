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
  final AudioPlayer _audioPlayer = AudioPlayer();
  String? _audioError;

  List<String> get _transcript => widget.episode.script
      .split('\n')
      .map((line) => line.replaceFirst(RegExp(r'^narrator:\s*'), '').trim())
      .where((line) => line.isNotEmpty && line != '---TOPIC_CHANGE---')
      .toList();

  @override
  void initState() {
    super.initState();
    _initAudio();
  }

  Future<void> _initAudio() async {
    if (widget.episode.audioUrl == null) {
      setState(() => _audioError = '오디오 파일이 아직 생성되지 않았습니다.');
      return;
    }

    try {
      await _audioPlayer.setUrl(widget.episode.audioUrl!);
    } catch (_) {
      if (!mounted) return;
      setState(() => _audioError = '오디오 로드 실패');
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
        title: const Text(
          '',
          style: TextStyle(color: Colors.white),
        ),
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
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: ListView.separated(
                itemCount: _transcript.length,
                separatorBuilder: (context, index) => const SizedBox(height: 16),
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
                  icon: const Icon(Icons.replay_10, color: Colors.white, size: 36),
                  onPressed: () async {
                    final position = _audioPlayer.position;
                    await _audioPlayer.seek(
                      Duration(seconds: (position.inSeconds - 10).clamp(0, position.inSeconds)),
                    );
                  },
                ),
                StreamBuilder<PlayerState>(
                  stream: _audioPlayer.playerStateStream,
                  builder: (context, snapshot) {
                    final playing = snapshot.data?.playing ?? false;
                    return IconButton(
                      icon: Icon(
                        playing ? Icons.pause_circle_filled : Icons.play_circle_fill,
                      ),
                      iconSize: 64,
                      color: Colors.white,
                      onPressed: widget.episode.audioUrl == null
                          ? null
                          : () {
                              if (playing) {
                                _audioPlayer.pause();
                              } else {
                                _audioPlayer.play();
                              }
                            },
                    );
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.forward_10, color: Colors.white, size: 36),
                  onPressed: () async {
                    final position = _audioPlayer.position;
                    await _audioPlayer.seek(Duration(seconds: position.inSeconds + 10));
                  },
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
