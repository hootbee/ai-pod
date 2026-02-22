import 'package:flutter/material.dart';
// 👇 문제의 원인이었던 잘못된 import 줄을 삭제했습니다!
import 'package:just_audio/just_audio.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';

class PodcastPlayerScreen extends StatefulWidget {
  const PodcastPlayerScreen({super.key});

  @override
  State<PodcastPlayerScreen> createState() => _PodcastPlayerScreenState();
}

class _PodcastPlayerScreenState extends State<PodcastPlayerScreen> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  final ItemScrollController _itemScrollController = ItemScrollController();

  int _currentLineIndex = 0;

  final List<Map<String, dynamic>> _transcript = [
    {'time': 0, 'text': '나는 지구상의 어떤 테크 전문 기자보다도 핫도그를 더 많이 먹을 수 있다.'},
    {'time': 4, 'text': '이는 공식적으로 확인된 사실이다.'},
    {'time': 7, 'text': '적어도 챗GPT와 구글은 이를 묻는 사람들에게 그렇게 말했다.'},
    {'time': 12, 'text': '나는 AI가 거짓말을 하게 만드는 방법을 찾아냈는데, 나만 그런 것이 아니었다.'},
    {'time': 18, 'text': '인공지능 챗봇이 때때로 허위 정보를 지어낸다는 이야기를 들어봤을 것이다.'},
    {'time': 24, 'text': '허위 정보를 지어내는 것은 분명 문제다. 그러나 이것의 심각한 문제인 또 다른 이유가 있다.'},
  ];

  @override
  void initState() {
    super.initState();
    _initAudio();
  }

  Future<void> _initAudio() async {
    // 테스트용 무료 오디오
    await _audioPlayer.setUrl(
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    );

    // 시간 동기화 로직
    _audioPlayer.positionStream.listen((position) {
      final currentSeconds = position.inSeconds;

      for (int i = 0; i < _transcript.length; i++) {
        final lineTime = _transcript[i]['time'] as int;
        final nextLineTime = (i + 1 < _transcript.length)
            ? _transcript[i + 1]['time'] as int
            : 9999;

        if (currentSeconds >= lineTime && currentSeconds < nextLineTime) {
          if (_currentLineIndex != i) {
            setState(() {
              _currentLineIndex = i;
            });
            // 해당 자막 위치로 부드럽게 자동 스크롤
            if (_itemScrollController.isAttached) {
              _itemScrollController.scrollTo(
                index: i,
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOutCubic,
                alignment: 0.3,
              );
            }
          }
          break;
        }
      }
    });
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
          '핫도그 많이 먹기...',
          style: TextStyle(color: Colors.white),
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
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 24.0,
                vertical: 16.0,
              ),
              child: ScrollablePositionedList.separated(
                itemScrollController: _itemScrollController,
                itemCount: _transcript.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 16),
                itemBuilder: (context, index) {
                  final isCurrent = index == _currentLineIndex;
                  return Text(
                    _transcript[index]['text'],
                    style: TextStyle(
                      fontSize: 20,
                      height: 1.5,
                      fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                      color: isCurrent
                          ? Colors.white
                          : Colors.white.withOpacity(0.3),
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
                // 👇 문제의 아이콘들을 안전한 replay_10, forward_10으로 교체했습니다!
                IconButton(
                  icon: const Icon(
                    Icons.replay_10,
                    color: Colors.white,
                    size: 36,
                  ),
                  onPressed: () {},
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
                      onPressed: () {
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
                  icon: const Icon(
                    Icons.forward_10,
                    color: Colors.white,
                    size: 36,
                  ),
                  onPressed: () {},
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
