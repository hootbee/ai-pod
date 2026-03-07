import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../core/app_config.dart';
import '../../shared/widgets/click_wheel.dart';
import '../card_news/card_news_screen.dart';
import 'podcast_player_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  final PageController _pageController = PageController(viewportFraction: 0.85);
  List<PodcastEpisodeItem> _episodes = [];
  int _currentIndex = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadEpisodes();
  }

  Future<void> _loadEpisodes() async {
    try {
      final response = await http
          .get(Uri.parse('${AppConfig.apiBaseUrl}/episodes'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception('episodes API 실패: ${response.statusCode}');
      }

      final decoded = jsonDecode(response.body) as List<dynamic>;
      final episodes = decoded
          .map((item) => PodcastEpisodeItem.fromJson(item as Map<String, dynamic>))
          .toList();

      if (!mounted) return;
      setState(() {
        _episodes = episodes;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _goToCardNews() {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            const CardNewsScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          // 오른쪽에서 왼쪽으로 스르륵 나타나는 애니메이션
          const begin = Offset(1.0, 0.0);
          const end = Offset.zero;
          const curve = Curves.easeInOut;
          var tween = Tween(
            begin: begin,
            end: end,
          ).chain(CurveTween(curve: curve));
          var offsetAnimation = animation.drive(tween);

          return SlideTransition(position: offsetAnimation, child: child);
        },
      ),
    );
  }

  // 다음 팟캐스트로 부드럽게 넘어가기
  void _nextPodcast() {
    if (_episodes.isEmpty) return;
    _pageController.nextPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  // 이전 팟캐스트로 부드럽게 넘어가기
  void _previousPodcast() {
    if (_episodes.isEmpty) return;
    _pageController.previousPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  // 가운데 버튼 클릭 시 상세 화면으로 이동
  void _enterPodcast() {
    if (_episodes.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => PodcastPlayerScreen(episode: _episodes[_currentIndex]),
      ),
    );
  }

  @override
  void dispose() {
    _pageController.dispose(); // 메모리 누수 방지
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 20),
            // 상단: 팟캐스트 커버 영역 (PageView)
            Expanded(
              child: _buildEpisodeSection(),
            ),

            // 하단: 우리가 만든 다이얼(Click Wheel)
            Padding(
              padding: const EdgeInsets.only(bottom: 60, top: 40),
              child: ClickWheel(
                onScrollRight: _nextPodcast,
                onScrollLeft: _previousPodcast,
                onCenterTap: _enterPodcast,
                onSwipeLeft: _goToCardNews,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEpisodeSection() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Text(
            '에피소드 로드 실패\n$_error',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    if (_episodes.isEmpty) {
      return const Center(child: Text('에피소드가 없습니다.'));
    }

    return PageView.builder(
      controller: _pageController,
      itemCount: _episodes.length,
      onPageChanged: (index) => setState(() => _currentIndex = index),
      itemBuilder: (context, index) {
        final episode = _episodes[index];
        final hasHeadline = episode.headline?.trim().isNotEmpty ?? false;
        final hasSubtitle = episode.subtitle?.trim().isNotEmpty ?? false;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
            image: episode.thumbnailUrl != null
                ? DecorationImage(
                    image: NetworkImage(episode.thumbnailUrl!),
                    fit: BoxFit.cover,
                  )
                : null,
            color: episode.thumbnailUrl == null ? Colors.blueGrey : null,
          ),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black.withOpacity(0.72)],
              ),
            ),
            alignment: Alignment.bottomLeft,
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasHeadline) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.42),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      episode.headline!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
                if (hasSubtitle) ...[
                  SizedBox(height: hasHeadline ? 10 : 0),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      episode.subtitle!,
                      softWrap: true,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.65,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFFECECEC),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class PodcastEpisodeItem {
  final String id;
  final String title;
  final String? headline;
  final String? subtitle;
  final String script;
  final String? audioUrl;
  final String? thumbnailUrl;

  PodcastEpisodeItem({
    required this.id,
    required this.title,
    required this.headline,
    required this.subtitle,
    required this.script,
    required this.audioUrl,
    required this.thumbnailUrl,
  });

  factory PodcastEpisodeItem.fromJson(Map<String, dynamic> json) {
    final audioPath = json['audioPath'] as String?;
    final thumbnailPath = json['thumbnailPath'] as String?;
    return PodcastEpisodeItem(
      id: json['id'] as String,
      title: json['title'] as String? ?? '제목 없음',
      headline: json['headline'] as String?,
      subtitle: json['headlineSubtitle'] as String?,
      script: json['script'] as String? ?? '',
      audioUrl: _toAbsoluteUrl(audioPath),
      thumbnailUrl: _toAbsoluteUrl(thumbnailPath),
    );
  }

  static String? _toAbsoluteUrl(String? rawPath) {
    if (rawPath == null || rawPath.isEmpty) return null;
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;
    return '${AppConfig.apiBaseUrl}$rawPath';
  }
}
