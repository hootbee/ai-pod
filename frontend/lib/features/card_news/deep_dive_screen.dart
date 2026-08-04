import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/app_config.dart';
import '../auth/auth_service.dart';
import '../../services/network_cache_service.dart';
import '../../shared/models/episode_source.dart';
import '../../shared/models/user_profile.dart';
import '../../shared/theme/app_theme_controller.dart';
import '../../shared/widgets/source_info_bottom_sheet.dart';

class DeepDiveScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onProfileTap;
  final String? initialEpisodeId;
  final String? initialDayLabel;
  final VoidCallback? onInitialFocusConsumed;

  const DeepDiveScreen({
    super.key,
    this.onBack,
    this.onProfileTap,
    this.initialEpisodeId,
    this.initialDayLabel,
    this.onInitialFocusConsumed,
  });

  @override
  State<DeepDiveScreen> createState() => _DeepDiveScreenState();
}

class _DeepDiveScreenState extends State<DeepDiveScreen> {
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasNextPage = false;
  int _offset = 0;
  String? _error;
  UserProfile? _userProfile;
  List<DeepDiveDay> _days = [];
  final PageController _dayPageController = PageController();
  final Map<int, PageController> _slideControllers = {};
  final Set<String> _viewCountedIds = {};
  static const int _pageLimit = 10;
  static const int _maxFocusLoadAttempts = 6;
  String? _pendingInitialEpisodeId;
  String? _pendingInitialDayLabel;
  bool _initialFocusConsumed = false;

  @override
  void initState() {
    super.initState();
    _pendingInitialEpisodeId = widget.initialEpisodeId;
    _pendingInitialDayLabel = widget.initialDayLabel;
    _load();
    _loadUserProfile();
  }

  @override
  void didUpdateWidget(covariant DeepDiveScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final incomingEpisodeId = widget.initialEpisodeId;
    final incomingDayLabel = widget.initialDayLabel;
    final hasNewFocusRequest =
        incomingEpisodeId != oldWidget.initialEpisodeId ||
        incomingDayLabel != oldWidget.initialDayLabel;
    if (!hasNewFocusRequest) return;
    if ((incomingEpisodeId == null || incomingEpisodeId.isEmpty) &&
        (incomingDayLabel == null || incomingDayLabel.isEmpty)) {
      return;
    }
    _pendingInitialEpisodeId = incomingEpisodeId;
    _pendingInitialDayLabel = incomingDayLabel;
    _initialFocusConsumed = false;
    if (!_loading) {
      _attemptInitialFocusAfterLoad();
    }
  }

  @override
  void dispose() {
    _dayPageController.dispose();
    for (final c in _slideControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await NetworkCacheService.instance.dio.get<dynamic>(
        '${AppConfig.apiBaseUrl}/card-news/deep-dive/latest',
        queryParameters: {'limit': _pageLimit, 'offset': 0},
      );
      final body = _toPaginatedBody(res.data);
      final list = body['data'] as List<dynamic>? ?? [];
      final days = _parseDays(list);

      if (!mounted) return;
      setState(() {
        _days = days;
        _offset = 0;
        _hasNextPage = body['hasNextPage'] as bool? ?? false;
        _disposeUnusedControllers(keepLength: _days.length);
        _loading = false;
      });
      _precacheFirstCardImage(days);
      await _attemptInitialFocusAfterLoad();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '딥다이브 카드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
        _loading = false;
      });
    }
  }

  void _precacheFirstCardImage(List<DeepDiveDay> days) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || days.isEmpty) return;
      final firstCard = days.first.cards.firstWhere(
        (card) => card.imageUrl?.isNotEmpty ?? false,
        orElse: () => days.first.cards.first,
      );
      final imageUrl = firstCard.imageUrl;
      if (imageUrl == null || imageUrl.isEmpty) return;
      final cacheWidth =
          (MediaQuery.sizeOf(context).width *
                  MediaQuery.devicePixelRatioOf(context))
              .round();

      precacheImage(
        CachedNetworkImageProvider(
          imageUrl,
          cacheManager: AppImageCacheManager.instance,
          maxWidth: cacheWidth,
        ),
        context,
      ).ignore();
    });
  }

  Future<bool> _loadMore() async {
    if (_loadingMore || !_hasNextPage) return false;
    setState(() => _loadingMore = true);
    var didAppend = false;
    try {
      final newOffset = _offset + _pageLimit;
      final res = await NetworkCacheService.instance.dio.get<dynamic>(
        '${AppConfig.apiBaseUrl}/card-news/deep-dive/latest',
        queryParameters: {'limit': _pageLimit, 'offset': newOffset},
      );
      final body = _toPaginatedBody(res.data);
      final newDays = _parseDays(body['data'] as List<dynamic>? ?? []);
      if (!mounted) return false;
      setState(() {
        _days = [..._days, ...newDays];
        _offset = newOffset;
        _hasNextPage = body['hasNextPage'] as bool? ?? false;
        _loadingMore = false;
      });
      didAppend = newDays.isNotEmpty;
    } catch (_) {
      if (!mounted) return false;
      setState(() => _loadingMore = false);
    }
    return didAppend;
  }

  Future<void> _attemptInitialFocusAfterLoad() async {
    if (_initialFocusConsumed || !mounted) return;
    final targetEpisodeId = _pendingInitialEpisodeId?.trim();
    final targetDayLabel = _pendingInitialDayLabel?.trim();
    if ((targetEpisodeId == null || targetEpisodeId.isEmpty) &&
        (targetDayLabel == null || targetDayLabel.isEmpty)) {
      _consumeInitialFocus();
      return;
    }

    var matchIndex = _findFocusIndex(
      targetEpisodeId: targetEpisodeId,
      targetDayLabel: targetDayLabel,
    );
    var attempts = 0;
    while (matchIndex < 0 && _hasNextPage && attempts < _maxFocusLoadAttempts) {
      final appended = await _loadMore();
      if (!appended) break;
      attempts += 1;
      matchIndex = _findFocusIndex(
        targetEpisodeId: targetEpisodeId,
        targetDayLabel: targetDayLabel,
      );
    }

    if (matchIndex >= 0 && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !_dayPageController.hasClients) return;
        _dayPageController.jumpToPage(matchIndex);
      });
    }

    _consumeInitialFocus();
  }

  int _findFocusIndex({String? targetEpisodeId, String? targetDayLabel}) {
    if (_days.isEmpty) return -1;
    if (targetEpisodeId != null && targetEpisodeId.isNotEmpty) {
      final byEpisode = _days.indexWhere((d) => d.episodeId == targetEpisodeId);
      if (byEpisode >= 0) return byEpisode;
    }
    if (targetDayLabel != null && targetDayLabel.isNotEmpty) {
      return _days.indexWhere((d) => d.dayLabel == targetDayLabel);
    }
    return -1;
  }

  void _consumeInitialFocus() {
    _initialFocusConsumed = true;
    _pendingInitialEpisodeId = null;
    _pendingInitialDayLabel = null;
    widget.onInitialFocusConsumed?.call();
  }

  Map<String, dynamic> _toPaginatedBody(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is List) {
      return {'data': raw, 'totalCount': raw.length, 'hasNextPage': false};
    }
    return {'data': <dynamic>[], 'totalCount': 0, 'hasNextPage': false};
  }

  List<DeepDiveDay> _parseDays(List<dynamic> list) {
    final days = <DeepDiveDay>[];

    for (final raw in list) {
      final item = Map<String, dynamic>.from(raw as Map);
      final snapshot = item['scriptSnapshot'] as Map<String, dynamic>?;
      final cardsJson = snapshot?['cards'] as List<dynamic>? ?? const [];
      if (cardsJson.isEmpty) continue;

      final cards = cardsJson
          .map(
            (c) =>
                DeepDiveCardMeta.fromJson(Map<String, dynamic>.from(c as Map)),
          )
          .toList();

      final episode = item['episode'] as Map<String, dynamic>? ?? const {};
      final episodeId = (episode['id'] as String?) ?? '';
      final createdAt =
          (episode['createdAt'] as String?) ??
          (item['createdAt'] as String?) ??
          '';
      final sourcesJson = episode['sources'] as List<dynamic>? ?? const [];
      final sources = sourcesJson
          .map((s) => EpisodeSource.fromJson(s as Map<String, dynamic>))
          .toList();
      final topicTitle = snapshot?['topicTitle'] as String? ?? '';

      days.add(
        DeepDiveDay(
          id: (item['id'] as String?) ?? '',
          episodeId: episodeId,
          dayLabel: _toDayLabel(createdAt),
          topicTitle: topicTitle,
          cards: cards,
          sources: sources,
        ),
      );
    }

    return days;
  }

  String _toDayLabel(String raw) {
    if (raw.length < 10) return '날짜 미상';
    return raw.substring(0, 10);
  }

  void _onSlideChanged(int dayIndex, int slideIndex) {
    if (slideIndex < 1) return;
    final id = _days[dayIndex].id;
    if (id.isEmpty || _viewCountedIds.contains(id)) return;
    _viewCountedIds.add(id);
    AuthService.readAccessToken().then((token) {
      if (token == null) return;
      http
          .post(
            Uri.parse('${AppConfig.apiBaseUrl}/card-news/$id/view-count'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .ignore();
    });
  }

  PageController _controllerFor(int dayIndex) {
    return _slideControllers.putIfAbsent(
      dayIndex,
      () => PageController(viewportFraction: 0.88),
    );
  }

  void _disposeUnusedControllers({required int keepLength}) {
    final stale = _slideControllers.keys.where((k) => k >= keepLength).toList();
    for (final k in stale) {
      _slideControllers.remove(k)?.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: AppThemeController.isLightMode,
      builder: (context, _, __) {
        return Scaffold(
          backgroundColor: AppThemeController.backgroundColor,
          body: _buildBody(),
        );
      },
    );
  }

  Future<void> _loadUserProfile() async {
    try {
      final profile = await AuthService().fetchUserProfile();
      if (!mounted) return;
      setState(() => _userProfile = profile);
    } catch (_) {
      // Profile is decorative here, so keep the fallback avatar on failure.
    }
  }

  Widget _buildBody() {
    if (_loading) {
      return Center(
        child: CircularProgressIndicator(
          color: AppThemeController.primaryTextColor,
        ),
      );
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Text(
            '로드 실패\n$_error',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppThemeController.secondaryTextColor(0.7)),
          ),
        ),
      );
    }
    if (_days.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.article_outlined,
              color: AppThemeController.secondaryTextColor(0.24),
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              '아직 딥다이브가 없어요',
              style: TextStyle(
                color: AppThemeController.secondaryTextColor(0.54),
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '다음 에피소드부터 자동으로 생성됩니다',
              style: TextStyle(
                color: AppThemeController.secondaryTextColor(0.3),
                fontSize: 13,
              ),
            ),
          ],
        ),
      );
    }

    final itemCount = _days.length + (_loadingMore ? 1 : 0);

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          Expanded(
            child: RefreshIndicator(
              color: Colors.white,
              backgroundColor: const Color(0xFF16162a),
              onRefresh: () async {
                setState(() {
                  _days = [];
                  _offset = 0;
                  _hasNextPage = false;
                  _loading = true;
                });
                await _load();
              },
              child: PageView.builder(
                controller: _dayPageController,
                scrollDirection: Axis.vertical,
                itemCount: itemCount,
                onPageChanged: (i) {
                  if (i >= _days.length - 1) _loadMore();
                },
                itemBuilder: (context, dayIndex) {
                  if (dayIndex == _days.length) {
                    return Center(
                      child: CircularProgressIndicator(
                        color: AppThemeController.primaryTextColor,
                      ),
                    );
                  }

                  final day = _days[dayIndex];
                  return PageView.custom(
                    key: ValueKey('pageview_$dayIndex'),
                    scrollDirection: Axis.horizontal,
                    controller: _controllerFor(dayIndex),
                    onPageChanged: (slideIndex) =>
                        _onSlideChanged(dayIndex, slideIndex),
                    childrenDelegate: SliverChildBuilderDelegate(
                      (context, slideIndex) {
                        final card = day.cards[slideIndex];

                        return Padding(
                          padding: const EdgeInsets.fromLTRB(8, 16, 10, 24),
                          child: _DeepDiveCardView(
                            card: card,
                            cardIndex: slideIndex + 1,
                            totalCards: day.cards.length,
                            sources: day.sources,
                          ),
                        );
                      },
                      addAutomaticKeepAlives: false,
                      addRepaintBoundaries: true,
                      childCount: day.cards.length,
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.only(left: 20, right: 30, top: 50, bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '카드뉴스',
            style: TextStyle(
              color: AppThemeController.primaryTextColor,
              fontSize: 34,
              fontWeight: FontWeight.w800,
              height: 1.05,
            ),
          ),
          GestureDetector(
            onTap: widget.onProfileTap,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppThemeController.secondaryTextColor(0.24),
                  width: 1.5,
                ),
                color: AppThemeController.isLightMode.value
                    ? const Color(0xFFE3E6DD)
                    : Colors.grey[900],
              ),
              child: ClipOval(
                child: _userProfile?.profileImageUrl != null
                    ? CachedNetworkImage(
                        imageUrl: _userProfile!.profileImageUrl!,
                        cacheManager: AppImageCacheManager.instance,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Icon(
                          Icons.person,
                          color: AppThemeController.primaryTextColor,
                          size: 24,
                        ),
                      )
                    : Icon(
                        Icons.person,
                        color: AppThemeController.primaryTextColor,
                        size: 24,
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── 카드 렌더러 ────────────────────────────────────────────────────────────────

class _DeepDiveCardView extends StatelessWidget {
  final DeepDiveCardMeta card;
  final int cardIndex;
  final int totalCards;
  final List<EpisodeSource> sources;

  const _DeepDiveCardView({
    required this.card,
    required this.cardIndex,
    required this.totalCards,
    this.sources = const [],
  });

  @override
  Widget build(BuildContext context) {
    return card.type == 'deep-thumbnail'
        ? _ThumbnailCard(
            card: card,
            cardIndex: cardIndex,
            totalCards: totalCards,
            sources: sources,
          )
        : _ContentCard(
            card: card,
            cardIndex: cardIndex,
            totalCards: totalCards,
            sources: sources,
          );
  }
}

// ─── 썸네일 카드 (1/4) ───────────────────────────────────────────────────────────

class _ThumbnailCard extends StatelessWidget {
  final DeepDiveCardMeta card;
  final int cardIndex;
  final int totalCards;
  final List<EpisodeSource> sources;

  const _ThumbnailCard({
    required this.card,
    required this.cardIndex,
    required this.totalCards,
    this.sources = const [],
  });

  @override
  Widget build(BuildContext context) {
    final accent = card.accentColorValue;

    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact = constraints.maxHeight < 600;
        final textScale = (constraints.maxHeight / 600)
            .clamp(0.78, 1.0)
            .toDouble();
        final titleMaxLines = isCompact ? 3 : 4;
        final subtitleMaxLines = isCompact ? 3 : 4;
        final bodyMaxLines = isCompact ? 4 : 5;

        return ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 배경 이미지
              if (card.imageUrl != null && card.imageUrl!.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: card.imageUrl!,
                  cacheManager: AppImageCacheManager.instance,
                  fit: BoxFit.cover,
                  filterQuality: FilterQuality.low,
                  memCacheWidth:
                      (MediaQuery.sizeOf(context).width *
                              MediaQuery.devicePixelRatioOf(context))
                          .round(),
                  placeholder: (_, __) =>
                      const ColoredBox(color: Color(0xFF0a0a14)),
                  errorWidget: (_, __, ___) =>
                      const ColoredBox(color: Color(0xFF0a0a14)),
                )
              else
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        accent.withValues(alpha: 0.3),
                        const Color(0xFF0a0a14),
                      ],
                    ),
                  ),
                ),

              // 그라디언트 오버레이
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.15),
                      Colors.black.withValues(alpha: 0.72),
                      Colors.black.withValues(alpha: 0.92),
                    ],
                    stops: const [0.0, 0.55, 1.0],
                  ),
                ),
              ),

              // 콘텐츠
              Padding(
                padding: EdgeInsets.all(isCompact ? 20 : 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 상단: 배지 + 진행 표시
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _DeepDiveBadge(label: 'DEEP DIVE', color: accent),
                        Text(
                          '$cardIndex / $totalCards',
                          style: const TextStyle(
                            color: Colors.white60,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),

                    const Spacer(),

                    // Breaking 레이블
                    Text(
                      'Breaking',
                      style: TextStyle(
                        color: accent,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // 자극적 제목
                    Text(
                      card.title,
                      maxLines: titleMaxLines,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 33 * textScale,
                        fontWeight: FontWeight.w800,
                        height: 1.16,
                      ),
                    ),
                    const SizedBox(height: 14),

                    // 액센트 구분선
                    Container(
                      width: 56,
                      height: 3,
                      decoration: BoxDecoration(
                        color: accent,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // 부제
                    if (card.subtitle != null && card.subtitle!.isNotEmpty)
                      Text(
                        card.subtitle!,
                        maxLines: subtitleMaxLines,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 17 * textScale,
                          fontWeight: FontWeight.w500,
                          height: 1.5,
                        ),
                      ),

                    const SizedBox(height: 12),

                    // 하단: 티저 + 링크
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Container(
                            alignment: Alignment.topLeft,
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    card.body,
                                    maxLines: bodyMaxLines,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: Colors.white.withValues(
                                        alpha: 0.65,
                                      ),
                                      fontSize: 13 * textScale,
                                      height: 1.5,
                                    ),
                                  ),
                                ),
                                if (sources.isNotEmpty)
                                  IconButton(
                                    icon: const Icon(
                                      Icons.link,
                                      color: Colors.white54,
                                      size: 18,
                                    ),
                                    padding: const EdgeInsets.all(4),
                                    constraints: const BoxConstraints(
                                      minWidth: 32,
                                      minHeight: 32,
                                    ),
                                    onPressed: () => showSourceInfoBottomSheet(
                                      context,
                                      sources: sources,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── 콘텐츠 카드 (2~4/4) ────────────────────────────────────────────────────────

class _ContentCard extends StatelessWidget {
  final DeepDiveCardMeta card;
  final int cardIndex;
  final int totalCards;
  final List<EpisodeSource> sources;

  const _ContentCard({
    required this.card,
    required this.cardIndex,
    required this.totalCards,
    this.sources = const [],
  });

  static const _badgeLabels = {
    'deep-background': '배경',
    'deep-detail': '핵심',
    'deep-impact': '영향',
  };

  @override
  Widget build(BuildContext context) {
    final accent = card.accentColorValue;
    final badge = _badgeLabels[card.type] ?? '';
    final paragraphs = card.body
        .split('\n')
        .where((p) => p.trim().isNotEmpty)
        .toList();

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0f0f1e),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 헤더: 액센트바 + 배지 + 진행 표시
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 4,
                      height: 32,
                      decoration: BoxDecoration(
                        color: accent,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 10),
                    _DeepDiveBadge(label: badge, color: accent, filled: false),
                  ],
                ),
                Text(
                  '$cardIndex / $totalCards',
                  style: const TextStyle(
                    color: Color(0xFF555570),
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // 제목
            Text(
              card.title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                height: 1.2,
                letterSpacing: -0.3,
              ),
            ),

            const SizedBox(height: 16),

            // 구분선
            Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [accent.withValues(alpha: 0.6), Colors.transparent],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // 본문 영역
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF16162a),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < paragraphs.length; i++) ...[
                        if (i > 0) const SizedBox(height: 14),
                        Text(
                          paragraphs[i],
                          style: TextStyle(
                            color: i == 0
                                ? Colors.white
                                : i == 1
                                ? accent
                                : Colors.white.withValues(alpha: 0.72),
                            fontSize: i == 0 ? 17 : 15,
                            fontWeight: i == 0
                                ? FontWeight.w700
                                : FontWeight.w500,
                            height: 1.6,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // 하단: aipod + 소스 링크
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'aipod',
                  style: TextStyle(
                    color: accent.withValues(alpha: 0.8),
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                if (sources.isNotEmpty)
                  IconButton(
                    icon: Icon(
                      Icons.link,
                      color: accent.withValues(alpha: 0.6),
                      size: 18,
                    ),
                    padding: const EdgeInsets.all(4),
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 32,
                    ),
                    onPressed: () =>
                        showSourceInfoBottomSheet(context, sources: sources),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─── 공통 배지 위젯 ─────────────────────────────────────────────────────────────

class _DeepDiveBadge extends StatelessWidget {
  final String label;
  final Color color;
  final bool filled;

  const _DeepDiveBadge({
    required this.label,
    required this.color,
    this.filled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: filled ? color : color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: filled ? Colors.white : color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
          letterSpacing: filled ? 1.5 : 0.5,
        ),
      ),
    );
  }
}

// ─── 모델 ──────────────────────────────────────────────────────────────────────

class DeepDiveDay {
  final String id;
  final String episodeId;
  final String dayLabel;
  final String topicTitle;
  final List<DeepDiveCardMeta> cards;
  final List<EpisodeSource> sources;

  const DeepDiveDay({
    required this.id,
    required this.episodeId,
    required this.dayLabel,
    required this.topicTitle,
    required this.cards,
    this.sources = const [],
  });
}

class DeepDiveCardMeta {
  final String type;
  final String title;
  final String? subtitle;
  final String body;
  final String accentColor;
  final String? imageUrl;

  const DeepDiveCardMeta({
    required this.type,
    required this.title,
    this.subtitle,
    required this.body,
    required this.accentColor,
    this.imageUrl,
  });

  Color get accentColorValue {
    const fixedTypeColors = {
      'deep-background': Color(0xFF66BB6A),
      'deep-detail': Color(0xFFFDD835),
      'deep-impact': Color(0xFFEF5350),
    };
    final fixedColor = fixedTypeColors[type];
    if (fixedColor != null) return fixedColor;

    try {
      final hex = accentColor.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return const Color(0xFF4FC3F7);
    }
  }

  factory DeepDiveCardMeta.fromJson(Map<String, dynamic> json) {
    return DeepDiveCardMeta(
      type: (json['type'] as String? ?? 'deep-background').trim(),
      title: (json['title'] as String? ?? '').trim(),
      subtitle: json['subtitle'] as String?,
      body: (json['body'] as String? ?? '').trim(),
      accentColor: (json['accentColor'] as String? ?? '#4FC3F7').trim(),
      imageUrl: json['imageUrl'] as String?,
    );
  }
}
