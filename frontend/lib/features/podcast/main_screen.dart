import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../core/app_config.dart';
import '../../services/network_cache_service.dart';
import '../../shared/models/episode_source.dart';
import '../../shared/widgets/click_wheel.dart';
import '../card_news/deep_dive_screen.dart';
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
  bool _loadingMore = false;
  bool _hasNextPage = false;
  int _offset = 0;
  String? _error;

  static const int _pageLimit = 10;

  @override
  void initState() {
    super.initState();
    _loadEpisodes();
  }

  Future<void> _loadEpisodes() async {
    try {
      final response = await NetworkCacheService.instance.dio
          .get<dynamic>(
        '${AppConfig.apiBaseUrl}/episodes',
        queryParameters: {'limit': _pageLimit, 'offset': 0},
      );

      final body = _toPaginatedBody(response.data);
      final items = (body['data'] as List<dynamic>? ?? [])
          .map((item) => PodcastEpisodeItem.fromJson(item as Map<String, dynamic>))
          .toList();

      if (!mounted) return;
      setState(() {
        _episodes = items;
        _offset = 0;
        _hasNextPage = body['hasNextPage'] as bool? ?? false;
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

  Future<void> _loadMoreEpisodes() async {
    if (_loadingMore || !_hasNextPage) return;

    setState(() => _loadingMore = true);

    try {
      final newOffset = _offset + _pageLimit;
      final response = await NetworkCacheService.instance.dio
          .get<dynamic>(
        '${AppConfig.apiBaseUrl}/episodes',
        queryParameters: {'limit': _pageLimit, 'offset': newOffset},
      );

      final body = _toPaginatedBody(response.data);
      final items = (body['data'] as List<dynamic>? ?? [])
          .map((item) => PodcastEpisodeItem.fromJson(item as Map<String, dynamic>))
          .toList();

      if (!mounted) return;
      setState(() {
        _episodes = [..._episodes, ...items];
        _offset = newOffset;
        _hasNextPage = body['hasNextPage'] as bool? ?? false;
        _loadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  /// 배열([]) 또는 페이징 객체({data, totalCount, hasNextPage}) 모두 처리
  Map<String, dynamic> _toPaginatedBody(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is List) {
      return {'data': raw, 'totalCount': raw.length, 'hasNextPage': false};
    }
    return {'data': <dynamic>[], 'totalCount': 0, 'hasNextPage': false};
  }

  void _goToCardNews() {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            const DeepDiveScreen(),
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
    if (_episodes.isEmpty || _currentIndex >= _episodes.length) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) =>
            PodcastPlayerScreen(episode: _episodes[_currentIndex]),
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
            Expanded(child: _buildEpisodeSection()),

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
          child: Text('에피소드 로드 실패\n$_error', textAlign: TextAlign.center),
        ),
      );
    }

    if (_episodes.isEmpty) {
      return const Center(child: Text('에피소드가 없습니다.'));
    }

    // 로딩 중일 때 마지막에 인디케이터 아이템 추가
    final itemCount = _episodes.length + (_loadingMore ? 1 : 0);

    return PageView.builder(
      controller: _pageController,
      itemCount: itemCount,
      onPageChanged: (index) {
        setState(() => _currentIndex = index);
        // 마지막 2개 항목 진입 시 다음 페이지 선제 로드
        if (index >= _episodes.length - 2) {
          _loadMoreEpisodes();
        }
      },
      itemBuilder: (context, index) {
        // 로딩 인디케이터 아이템
        if (index == _episodes.length) {
          return const Center(child: CircularProgressIndicator());
        }

        final episode = _episodes[index];
        final hasHeadline = episode.headline?.trim().isNotEmpty ?? false;
        final hasSubtitle = episode.subtitle?.trim().isNotEmpty ?? false;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
            image: episode.thumbnailUrl != null
                ? DecorationImage(
                    image: CachedNetworkImageProvider(
                      episode.thumbnailUrl!,
                      cacheManager: AppImageCacheManager.instance,
                    ),
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
                colors: [Colors.transparent, Colors.black.withValues(alpha: 0.72)],
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
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.42),
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
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.3),
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
  final DateTime? createdAt;
  final String? headline;
  final String? subtitle;
  final String script;
  final String? audioStatus;
  final String? audioUrl;
  final String streamUrl;
  final String? subtitleCuesUrl;
  final String? thumbnailUrl;
  final List<EpisodeSource> sources;

  PodcastEpisodeItem({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.headline,
    required this.subtitle,
    required this.script,
    required this.audioStatus,
    required this.audioUrl,
    required this.streamUrl,
    required this.subtitleCuesUrl,
    required this.thumbnailUrl,
    this.sources = const [],
  });

  factory PodcastEpisodeItem.fromJson(Map<String, dynamic> json) {
    final audioPath = json['audioPath'] as String?;
    final thumbnailPath = json['thumbnailPath'] as String?;
    final streamExt = _extractStreamExt(audioPath);
    final sourcesJson = json['sources'] as List<dynamic>? ?? const [];
    return PodcastEpisodeItem(
      id: json['id'] as String,
      title: json['title'] as String? ?? '제목 없음',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      headline: json['headline'] as String?,
      subtitle: json['headlineSubtitle'] as String?,
      script: json['script'] as String? ?? '',
      audioStatus: json['audioStatus'] as String?,
      audioUrl: _toAbsoluteUrl(audioPath),
      streamUrl:
          '${AppConfig.apiBaseUrl}/episodes/${json['id']}/audio/stream.$streamExt'
              .trim(),
      subtitleCuesUrl: _toAbsoluteUrl(json['subtitleCuesPath'] as String?),
      thumbnailUrl: _toAbsoluteUrl(thumbnailPath),
      sources: sourcesJson
          .map((s) => EpisodeSource.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }

  static String? _toAbsoluteUrl(String? rawPath) {
    if (rawPath == null || rawPath.isEmpty) return null;
    final normalized = rawPath.replaceAll(RegExp(r'\s+'), '').trim();
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }
    return '${AppConfig.apiBaseUrl}$normalized';
  }

  static String _extractStreamExt(String? rawPath) {
    if (rawPath == null || rawPath.isEmpty) return 'mp3';

    final normalized = rawPath
        .replaceAll(RegExp(r'\s+'), '')
        .trim()
        .split('?')
        .first;
    final dotIndex = normalized.lastIndexOf('.');
    if (dotIndex <= -1 || dotIndex >= normalized.length - 1) return 'mp3';

    final ext = normalized.substring(dotIndex + 1).toLowerCase();
    switch (ext) {
      case 'm4a':
      case 'mp4a':
        return 'm4a';
      case 'mp3':
      case 'wav':
      case 'aac':
        return ext;
      default:
        return 'mp3';
    }
  }
}
