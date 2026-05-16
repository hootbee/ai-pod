import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart' show Options;
import 'package:flutter/material.dart';
import '../../core/app_config.dart';
import '../../services/network_cache_service.dart';
import '../../shared/models/episode_source.dart';
import '../../shared/models/user_profile.dart';
import '../../shared/widgets/click_wheel.dart';
import '../auth/auth_service.dart';
import '../auth/login_screen.dart';
import '../card_news/deep_dive_screen.dart';
import 'podcast_player_screen.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:just_audio/just_audio.dart';
import '../../services/audio_handler.dart';
import 'dart:ui';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen>
    with SingleTickerProviderStateMixin {
  int _currentTabIndex = 0;
  late final AnimationController _tabTransitionController;

  void _onTabSelected(int index) {
    if (index == _currentTabIndex) return;
    setState(() => _currentTabIndex = index);
    _tabTransitionController.forward(from: 0);
    if (index == 2) _loadHistory();
  }
  final PageController _pageController = PageController(viewportFraction: 0.85);
  UserProfile? _userProfile;
  List<PodcastEpisodeItem> _episodes = [];
  int _currentIndex = 0;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasNextPage = false;
  int _offset = 0;
  String? _error;

  List<_HistoryEntry> _historyItems = [];
  bool _historyLoading = false;
  bool _historyLoaded = false;

  static const int _pageLimit = 10;

  @override
  void initState() {
    super.initState();
    _tabTransitionController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 240),
      value: 1,
    );
    _loadEpisodes();
    _loadUserProfile();
  }

  Future<void> _loadUserProfile() async {
    try {
      final profile = await AuthService().fetchUserProfile();
      if (!mounted) return;
      setState(() => _userProfile = profile);
    } catch (_) {}
  }

  Future<void> _logout() async {
    await AuthService().logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => const LoginScreen(),
        transitionsBuilder: (_, animation, __, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
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

  /*void _goToCardNews() {
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
  }*/

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

  void _enterPodcast({PodcastEpisodeItem? targetEpisode}) {
    final episode = targetEpisode ??
        (_episodes.isNotEmpty && _currentIndex < _episodes.length ? _episodes[_currentIndex] : null);
    if (episode == null) return;

    Navigator.of(context)
        .push(MaterialPageRoute(
          builder: (context) => PodcastPlayerScreen(episode: episode),
        ))
        .then((_) => setState(() => _historyLoaded = false));
  }

  Future<void> _toggleCurrentPodcast() async {
    if (_episodes.isEmpty || _currentIndex >= _episodes.length) return;

    final episode = _episodes[_currentIndex];
    final player = AudioHandler.instance.player;
    final isCurrent = AudioHandler.instance.currentEpisodeId == episode.id;

    if (isCurrent) {
      if (player.playing) {
        await player.pause();
      } else {
        await player.play();
      }
      return;
    }

    await AudioHandler.instance.playEpisode(episode);
  }

  Future<void> _loadHistory() async {
    if (_historyLoaded) return;
    setState(() => _historyLoading = true);
    try {
      final token = await AuthService.readAccessToken();
      final response = await NetworkCacheService.instance.dio.get<dynamic>(
        '${AppConfig.apiBaseUrl}/users/me/history',
        queryParameters: {'limit': 20, 'offset': 0},
        options: Options(
          headers: token != null ? {'Authorization': 'Bearer $token'} : null,
        ),
      );
      final body = _toPaginatedBody(response.data);
      final items = (body['data'] as List<dynamic>? ?? []).map((item) {
        final json = item as Map<String, dynamic>;
        return _HistoryEntry(
          episode: PodcastEpisodeItem.fromJson(json),
          lastPlayedAt:
              DateTime.tryParse(json['lastPlayedAt'] as String? ?? '') ??
              DateTime.now(),
        );
      }).toList();
      if (!mounted) return;
      setState(() {
        _historyItems = items;
        _historyLoading = false;
        _historyLoaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _historyLoading = false);
    }
  }

  @override
  void dispose() {
    _tabTransitionController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<PlayerState>(
      stream: AudioHandler.instance.player.playerStateStream,
      builder: (context, snapshot) {
        final bool isPlaying = snapshot.data?.playing ?? false;

        PodcastEpisodeItem? currentEpisode;
        if (isPlaying && _episodes.isNotEmpty) {
          try {
            currentEpisode = _episodes.firstWhere(
              (e) => e.id == AudioHandler.instance.currentEpisodeId,
            );
          } catch (_) {
            currentEpisode = _currentIndex < _episodes.length ? _episodes[_currentIndex] : null;
          }
        } else {
          currentEpisode = _episodes.isNotEmpty && _currentIndex < _episodes.length ? _episodes[_currentIndex] : null;
        }

        return Scaffold(
          backgroundColor: const Color(0xFF1E211A),
          body: _buildTabSurface(isPlaying),
          bottomNavigationBar: _buildBottomNavBar(context, isPlaying, currentEpisode, _currentTabIndex, _onTabSelected),
        );
      },
    );
  }

  Widget _buildTabSurface(bool isPlaying) {
    return AnimatedBuilder(
      animation: _tabTransitionController,
      builder: (context, child) {
        final value =
            Curves.easeOutCubic.transform(_tabTransitionController.value);
        final scale = 0.985 + (0.015 * value);
        final verticalOffset =
            MediaQuery.of(context).size.height * 0.018 * (1 - value);

        return FadeTransition(
          opacity: AlwaysStoppedAnimation(value),
          child: Transform.translate(
            offset: Offset(0, verticalOffset),
            child: Transform.scale(
              scale: scale,
              alignment: Alignment.bottomCenter,
              child: child,
            ),
          ),
        );
      },
      child: IndexedStack(
        index: _currentTabIndex,
        children: [
          _buildHomeTab(isPlaying),
          DeepDiveScreen(onBack: () => _onTabSelected(0)),
          _buildLibraryTab(),
        ],
      ),
    );
  }

  Widget _buildHomeTab(bool isPlaying) {
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(
              left: 20,
              right: 30,
              top: 50,
              bottom: 24,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildHeaderTitle('홈'),
                _buildProfileAvatar(),
              ],
            ),
          ),
          Expanded(
            flex: 4,
            child: _buildEpisodeSection(),
          ),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onHorizontalDragEnd: (details) {
              if (details.primaryVelocity! < -300) {
                _onTabSelected(1);
              }
            },
            child: const SizedBox(
              width: double.infinity,
              height: 40,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 50),
            child: ClickWheel(
              onScrollRight: _nextPodcast,
              onScrollLeft: _previousPodcast,
              onCenterTap: _toggleCurrentPodcast,
              isPlaying: isPlaying,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNavBar(BuildContext context, bool isPlaying, PodcastEpisodeItem? currentEpisode, int selectedIndex, Function(int) onTabSelected) {
    final double screenWidth = MediaQuery.of(context).size.width;
  final double navBarHeight = (screenWidth * 0.08).clamp(56.0, 70.0);
  final double navBarWidth = screenWidth - 40 - 16 - navBarHeight;

  return SafeArea(
    child: Padding(
      padding: const EdgeInsets.only(bottom: 20.0, left: 20.0, right: 20.0),
      child: Row(
        mainAxisAlignment: isPlaying ? MainAxisAlignment.start : MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: navBarWidth,
            height: navBarHeight,
            decoration: BoxDecoration(
                color: const Color(0xFF50583D),
                borderRadius: BorderRadius.circular(navBarHeight / 2),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  GestureDetector(
                    onTap: () => onTabSelected(0),
                    child: _buildNavItem(context, Symbols.podcasts, "팟캐스트", isSelected: selectedIndex == 0),
                  ),
                  GestureDetector(
                    onTap: () => onTabSelected(1),
                    child: _buildNavItem(context, Symbols.cards_stack, "카드뉴스", isSelected: selectedIndex == 1),
                  ),
                  GestureDetector(
                    onTap: () => onTabSelected(2),
                    child: _buildNavItem(context, Symbols.person, "보관함", isSelected: selectedIndex == 2),
                  ),
                ],
              ),
            ),

                if (isPlaying && currentEpisode?.thumbnailUrl != null) ...[
                const SizedBox(width: 16),
                GestureDetector(
                  onTap: () => _enterPodcast(targetEpisode: currentEpisode),
                  child: Container(
                    width: navBarHeight,
                    height: navBarHeight,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      image: DecorationImage(
                        image: CachedNetworkImageProvider(currentEpisode!.thumbnailUrl!),
                        fit: BoxFit.cover,
                        ),
                        border: Border.all(color: Colors.white10, width: 1),
                        boxShadow: [
                          BoxShadow(
                          color: Colors.black.withValues(alpha:0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

Widget _buildNavItem(BuildContext context, IconData icon, String label, {bool isSelected = false}) {
  final double screenWidth = MediaQuery.of(context).size.width;
  final double itemWidth = (screenWidth * 0.21).clamp(70.0, 250.0);
  final double itemHeight = (screenWidth * 0.1).clamp(43.0, 60.0);
  final double iconSize = (screenWidth * 0.03).clamp(20.0, 26.0);
  final double fontSize = (screenWidth * 0.015).clamp(10.0, 14.0);

  return Container(
    width: itemWidth,
    height: itemHeight,
    decoration: BoxDecoration(
      color: isSelected ? const Color(0xFFA1A98F) : Colors.transparent,
      borderRadius: BorderRadius.circular(itemHeight / 2),
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: iconSize,
          color: isSelected ? const Color(0xFFB8FF00) : Colors.black87,
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: isSelected ? const Color(0xFFB8FF00) : Colors.black87,
            fontSize: fontSize,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

Widget _buildHeaderTitle(String title) {
  return Text(
    title,
    style: const TextStyle(
      color: Colors.white,
      fontSize: 34,
      fontWeight: FontWeight.w800,
      height: 1.05,
    ),
  );
}

Widget _buildProfileAvatar() {
  return Container(
    width: 44,
    height: 44,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white24, width: 1.5),
      color: Colors.grey[900],
    ),
    child: ClipOval(
      child: _userProfile?.profileImageUrl != null
          ? CachedNetworkImage(
              imageUrl: _userProfile!.profileImageUrl!,
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) =>
                  const Icon(Icons.person, color: Colors.white, size: 24),
            )
          : const Icon(Icons.person, color: Colors.white, size: 24),
    ),
  );
}

Widget _buildLibraryTab() {
  return SafeArea(
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 20, right: 30, top: 50, bottom: 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildHeaderTitle('보관함'),
              _buildProfileAvatar(),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 35, horizontal: 24),
                  decoration: BoxDecoration(
                    color: const Color(0xFF434A38),
                    borderRadius: BorderRadius.circular(28),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white24, width: 2),
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                        child: ClipOval(
                          child: _userProfile?.profileImageUrl != null
                              ? CachedNetworkImage(
                                  imageUrl: _userProfile!.profileImageUrl!,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) =>
                                      const Icon(Icons.person, color: Colors.white, size: 50),
                                )
                              : const Icon(Icons.person, color: Colors.white, size: 50),
                        ),
                      ),
                      const SizedBox(width: 20),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _userProfile?.nickname ?? '로그인이 필요합니다',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _userProfile?.email ?? '계정 정보를 불러올 수 없습니다',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.5),
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 25),

                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF434A38),
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Symbols.stacks, color: Colors.white, size: 25),
                            SizedBox(width: 10),
                            Text('기록', style: TextStyle(color: Colors.white, fontSize: 15)),
                          ],
                        ),
                        Expanded(
                          child: _historyLoading
                              ? const Center(
                                  child: CircularProgressIndicator(
                                    color: Colors.white54,
                                    strokeWidth: 2,
                                  ),
                                )
                              : _historyItems.isEmpty
                                  ? Center(
                                      child: Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Symbols.history,
                                            color: Colors.white
                                                .withValues(alpha: 0.3),
                                            size: 48,
                                          ),
                                          const SizedBox(height: 12),
                                          Text(
                                            '아직 청취 기록이 없습니다',
                                            style: TextStyle(
                                              color: Colors.white
                                                  .withValues(alpha: 0.4),
                                              fontSize: 14,
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                  : ListView.separated(
                                      padding:
                                          const EdgeInsets.only(top: 12),
                                      itemCount: _historyItems.length,
                                      separatorBuilder: (_, __) => Divider(
                                        color: Colors.white
                                            .withValues(alpha: 0.08),
                                        height: 1,
                                      ),
                                      itemBuilder: (context, index) {
                                        final entry =
                                            _historyItems[index];
                                        return _HistoryListTile(
                                          entry: entry,
                                          onTap: () => _enterPodcast(
                                              targetEpisode:
                                                  entry.episode),
                                        );
                                      },
                                    ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                GestureDetector(
                  onTap: _logout,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      '로그아웃',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.35),
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 4),
              ],
            ),
          ),
        ),
      ],
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
  if (index == _episodes.length) {
    return const Center(child: CircularProgressIndicator());
  }

  final episode = _episodes[index];

  return FlipThumbnailCard(
    episode: episode,
    onTap: _enterPodcast,
    onCardNewsTap: () => _onTabSelected(1),
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

class FlipThumbnailCard extends StatefulWidget {
  final PodcastEpisodeItem episode;
  final VoidCallback onTap;
  final VoidCallback? onCardNewsTap;

  const FlipThumbnailCard({
    super.key,
    required this.episode,
    required this.onTap,
    this.onCardNewsTap,
  });

  @override
  State<FlipThumbnailCard> createState() => _FlipThumbnailCardState();
}

class _FlipThumbnailCardState extends State<FlipThumbnailCard> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  bool _isFlipped = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _flipToBack() {
    _isFlipped = true;
    _controller.forward();
  }

  void _flipToFront() {
    _isFlipped = false;
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _isFlipped ? _flipToFront : widget.onTap,
      onLongPress: _isFlipped ? null : _flipToBack,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final angle = _controller.value * 3.141592; 
          return Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateY(angle),
            alignment: Alignment.center,
            child: angle < 3.141592 / 2
                ? _buildFront() 
                : Transform(
                    transform: Matrix4.identity()..rotateY(3.141592),
                    alignment: Alignment.center,
                    child: _buildBack(),
                  ),
          );
        },
      ),
    );
  }

  Widget _buildFront() {
    final hasHeadline = widget.episode.headline?.trim().isNotEmpty ?? false;
    final hasSubtitle = widget.episode.subtitle?.trim().isNotEmpty ?? false;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10),
      child: ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Stack(
        children: [
          Positioned.fill(
            child: CachedNetworkImage(
              imageUrl: widget.episode.thumbnailUrl ?? '',
              fit: BoxFit.cover,
              placeholder: (context, url) => Container(
                color: Colors.blueGrey.shade900,
                child: const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFFD6E36F),
                    strokeWidth: 4,
                  ),
                ),
              ),
              errorWidget: (context, url, error) => Container(
                color: Colors.blueGrey.shade900,
                child: const Center(
                  child: Icon(Icons.broken_image, color: Colors.white24, size: 40),
                ),
              ),
            ),
          ),

          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.5, 0.7, 1.0],
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.3),
                    Colors.black.withValues(alpha: 0.9),
                  ],
                ),
              ),
            ),
          ),

          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (hasHeadline) ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 4,
                          height: 28,
                          margin: const EdgeInsets.only(top: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD6E36F),
                            borderRadius: BorderRadius.circular(2),
                            boxShadow: [
                              BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 4),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            widget.episode.headline!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: -0.2,
                              height: 1.2,
                              shadows: [
                                Shadow(
                                  offset: const Offset(0, 2),
                                  blurRadius: 8.0,
                                  color: Colors.black.withValues(alpha: 0.8),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (hasSubtitle) ...[
                    const SizedBox(height: 14),
                    Padding(
                      padding: const EdgeInsets.only(left: 16),
                      child: Text(
                        widget.episode.subtitle!,
                        softWrap: true,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.6,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withValues(alpha: 0.85),
                          letterSpacing: -0.2,
                          shadows: [
                            Shadow(
                              offset: const Offset(0, 1),
                              blurRadius: 4.0,
                              color: Colors.black.withValues(alpha: 0.8),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Positioned(
              top: 16,
              right: 16,
              child: StreamBuilder<String?>(
                stream: AudioHandler.instance.player.sequenceStateStream.map((_) => AudioHandler.instance.currentEpisodeId),
                builder: (context, idSnapshot) {
                  final bool isCurrent = idSnapshot.data == widget.episode.id;

                  return StreamBuilder<PlayerState>(
                    stream: AudioHandler.instance.player.playerStateStream,
                    builder: (context, stateSnapshot) {
                      final bool isPlaying = isCurrent && (stateSnapshot.data?.playing ?? false);

                      return GestureDetector(
                        onTap: () {
                          if (isCurrent) {
                            isPlaying ? AudioHandler.instance.player.pause() : AudioHandler.instance.player.play();
                          } else {
                            AudioHandler.instance.playEpisode(widget.episode);
                          }
                        },
                        child: ClipOval(
                          child: BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 10.0, sigmaY: 10.0),
                            child: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.3),
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white.withValues(alpha: 0.2), width: 1),
                              ),
                              child: Icon(
                                isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                color: const Color(0xFFD6E36F),
                                size: 28,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
    ),
    );  
  }

  Widget _buildBack() {
    final date = widget.episode.createdAt;
    final dateStr = date != null
        ? '${date.year}.${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')}'
        : '';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF2A2D24),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white10, width: 1),
      ),
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (dateStr.isNotEmpty)
            Text(
              dateStr,
              style: const TextStyle(color: Color(0xFFD6E36F), fontSize: 13, fontWeight: FontWeight.w600),
            ),
          const SizedBox(height: 10),
          Text(
            widget.episode.title,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17, height: 1.4),
          ),
          const Spacer(),
          GestureDetector(
            onTap: widget.onCardNewsTap,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFD6E36F),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.auto_awesome_mosaic_rounded, color: Color(0xFF1A1C17), size: 18),
                  SizedBox(width: 8),
                  Text(
                    '카드뉴스 보기',
                    style: TextStyle(color: Color(0xFF1A1C17), fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 청취 기록 데이터 모델
// ─────────────────────────────────────────────────────────────────────────────
class _HistoryEntry {
  final PodcastEpisodeItem episode;
  final DateTime lastPlayedAt;

  _HistoryEntry({required this.episode, required this.lastPlayedAt});
}

// ─────────────────────────────────────────────────────────────────────────────
// 청취 기록 목록 아이템
// ─────────────────────────────────────────────────────────────────────────────
class _HistoryListTile extends StatelessWidget {
  final _HistoryEntry entry;
  final VoidCallback onTap;

  const _HistoryListTile({required this.entry, required this.onTap});

  String _relativeDate(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inDays == 0) return '오늘';
    if (diff.inDays == 1) return '어제';
    if (diff.inDays < 7) return '${diff.inDays}일 전';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}주 전';
    if (diff.inDays < 365) return '${(diff.inDays / 30).floor()}달 전';
    return '${(diff.inDays / 365).floor()}년 전';
  }

  @override
  Widget build(BuildContext context) {
    final ep = entry.episode;
    return InkWell(
      onTap: onTap,
      splashColor: Colors.white.withValues(alpha: 0.05),
      highlightColor: Colors.transparent,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: ep.thumbnailUrl != null
                  ? CachedNetworkImage(
                      imageUrl: ep.thumbnailUrl!,
                      width: 56,
                      height: 56,
                      fit: BoxFit.cover,
                      cacheManager: AppImageCacheManager.instance,
                      errorWidget: (_, __, ___) => _placeholder(),
                    )
                  : _placeholder(),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ep.headline ?? ep.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _relativeDate(entry.lastPlayedAt),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.45),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.chevron_right,
              color: Colors.white.withValues(alpha: 0.25),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      width: 56,
      height: 56,
      color: const Color(0xFF2E3228),
      child: const Icon(Icons.headphones, color: Colors.white38, size: 24),
    );
  }
}
