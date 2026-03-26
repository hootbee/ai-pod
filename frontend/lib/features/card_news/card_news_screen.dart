import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/app_config.dart';
import '../../services/network_cache_service.dart';
import '../../shared/models/episode_source.dart';
import '../../shared/widgets/source_info_bottom_sheet.dart';

class CardNewsScreen extends StatefulWidget {
  const CardNewsScreen({super.key});

  @override
  State<CardNewsScreen> createState() => _CardNewsScreenState();
}

class _CardNewsScreenState extends State<CardNewsScreen> {
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasNextPage = false;
  int _offset = 0;
  String? _error;
  List<DayCardNews> _days = [];
  final Map<int, PageController> _slideControllers = {};
  final Set<String> _viewCountedIds = {};
  static const int _pageLimit = 10;

  @override
  void initState() {
    super.initState();
    _loadCardNewsBody();
  }

  @override
  void dispose() {
    for (final controller in _slideControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadCardNewsBody() async {
    try {
      final latestCardNewsRes = await NetworkCacheService.instance.dio
          .get<dynamic>(
        '${AppConfig.apiBaseUrl}/card-news/latest',
        queryParameters: {'limit': _pageLimit, 'offset': 0},
      );

      final body = _toPaginatedBody(latestCardNewsRes.data);
      final latestCardNewsList = body['data'] as List<dynamic>? ?? [];

      if (latestCardNewsList.isEmpty) {
        throw Exception('카드뉴스가 없습니다.');
      }

      final days = _parseDays(latestCardNewsList);

      if (days.isEmpty) {
        throw Exception('카드뉴스 이미지가 없습니다.');
      }

      if (!mounted) return;
      setState(() {
        _days = days;
        _offset = 0;
        _hasNextPage = body['hasNextPage'] as bool? ?? false;
        _disposeUnusedSlideControllers(keepLength: _days.length);
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

  Future<void> _loadMoreCardNews() async {
    if (_loadingMore || !_hasNextPage) return;

    setState(() => _loadingMore = true);

    try {
      final newOffset = _offset + _pageLimit;
      final latestCardNewsRes = await NetworkCacheService.instance.dio
          .get<dynamic>(
        '${AppConfig.apiBaseUrl}/card-news/latest',
        queryParameters: {'limit': _pageLimit, 'offset': newOffset},
      );

      final body = _toPaginatedBody(latestCardNewsRes.data);
      final latestCardNewsList = body['data'] as List<dynamic>? ?? [];
      final newDays = _parseDays(latestCardNewsList);

      if (!mounted) return;
      setState(() {
        _days = [..._days, ...newDays];
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

  List<DayCardNews> _parseDays(List<dynamic> latestCardNewsList) {
    final days = <DayCardNews>[];

    for (final rawCardNews in latestCardNewsList) {
      final latestCardNews = Map<String, dynamic>.from(rawCardNews as Map);
      final imagePathsJson = latestCardNews['imagePaths'] as List<dynamic>?;
      if (imagePathsJson == null || imagePathsJson.isEmpty) continue;

      final scriptSnapshot =
          latestCardNews['scriptSnapshot'] as Map<String, dynamic>?;
      final slidesJson =
          scriptSnapshot?['slides'] as List<dynamic>? ?? const [];
      final slideMetas = slidesJson
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(CardSlideMeta.fromJson)
          .toList();
      final imageUrls = imagePathsJson
          .map((item) => _toAbsoluteCardNewsImageUrl((item as String?) ?? ''))
          .where((url) => url.isNotEmpty)
          .toList();

      if (imageUrls.isEmpty) continue;

      final cards = <CardNewsCard>[];
      for (var i = 0; i < imageUrls.length; i++) {
        final meta = i < slideMetas.length ? slideMetas[i] : null;
        // raw Unsplash URL이 있으면 우선 사용, 없으면 템플릿 PNG 폴백
        final displayUrl = (meta?.imageUrl != null && meta!.imageUrl!.isNotEmpty)
            ? meta.imageUrl!
            : imageUrls[i];
        cards.add(CardNewsCard(imageUrl: displayUrl, meta: meta));
      }

      final episode =
          latestCardNews['episode'] as Map<String, dynamic>? ?? const {};
      final createdAt =
          (episode['createdAt'] as String?) ??
          (latestCardNews['createdAt'] as String?) ??
          '';
      final sourcesJson = episode['sources'] as List<dynamic>? ?? const [];
      final sources = sourcesJson
          .map((s) => EpisodeSource.fromJson(s as Map<String, dynamic>))
          .toList();
      days.add(DayCardNews(
        id: (latestCardNews['id'] as String?) ?? '',
        dayLabel: _toDayLabel(createdAt),
        cards: cards,
        sources: sources,
      ));
    }

    return days;
  }

  void _onSlidePageChanged(int dayIndex, int slideIndex) {
    if (slideIndex < 1) return;
    final id = _days[dayIndex].id;
    if (id.isEmpty || _viewCountedIds.contains(id)) return;
    _viewCountedIds.add(id);
    SharedPreferences.getInstance().then((prefs) {
      final token = prefs.getString('access_token');
      if (token == null) return;
      http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/card-news/$id/view-count'),
        headers: {'Authorization': 'Bearer $token'},
      ).ignore();
    });
  }

  PageController _slideControllerForDay(int dayIndex) {
    return _slideControllers.putIfAbsent(
      dayIndex,
      () => PageController(viewportFraction: 0.88),
    );
  }

  void _disposeUnusedSlideControllers({required int keepLength}) {
    final staleKeys = _slideControllers.keys
        .where((index) => index >= keepLength)
        .toList();
    for (final key in staleKeys) {
      _slideControllers.remove(key)?.dispose();
    }
  }

  String _toDayLabel(String raw) {
    if (raw.length < 10) return '날짜 미상';
    return raw.substring(0, 10);
  }

  String _toAbsoluteCardNewsImageUrl(String rawPath) {
    final normalized = rawPath.trim().replaceAll('\\', '/');
    if (normalized.isEmpty) return '';
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }
    if (normalized.startsWith('/card-news-images/')) {
      return '${AppConfig.apiBaseUrl}$normalized';
    }
    final fileName = normalized.split('/').last;
    if (fileName.isEmpty) return '';
    return '${AppConfig.apiBaseUrl}/card-news-images/$fileName';
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
        title: const Text('오늘의 AI 뉴스', style: TextStyle(color: Colors.white)),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Text(
            '카드뉴스 로드 실패\n$_error',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white),
          ),
        ),
      );
    }
    if (_days.isEmpty) {
      return const Center(
        child: Text('카드뉴스 이미지가 없습니다.', style: TextStyle(color: Colors.white)),
      );
    }

    final itemCount = _days.length + (_loadingMore ? 1 : 0);

    return PageView.builder(
      scrollDirection: Axis.vertical,
      itemCount: itemCount,
      onPageChanged: (dayIndex) {
        if (dayIndex >= _days.length - 1) {
          _loadMoreCardNews();
        }
      },
      itemBuilder: (context, dayIndex) {
        if (dayIndex == _days.length) {
          return const Center(
            child: CircularProgressIndicator(color: Colors.white),
          );
        }

        final day = _days[dayIndex];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Text(
                '${day.dayLabel} (${dayIndex + 1}/${_days.length})',
                style: const TextStyle(
                  color: Color(0xFFB8C0A6),
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                scrollDirection: Axis.horizontal,
                controller: _slideControllerForDay(dayIndex),
                onPageChanged: (slideIndex) =>
                    _onSlidePageChanged(dayIndex, slideIndex),
                itemCount: day.cards.length,
                itemBuilder: (context, slideIndex) {
                  final card = day.cards[slideIndex];
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(8, 24, 10, 24),
                    child: _CardNewsSlideView(
                      card: card,
                      slideIndex: slideIndex,
                      totalSlides: day.cards.length,
                      sources: day.sources,
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

class DayCardNews {
  final String id;
  final String dayLabel;
  final List<CardNewsCard> cards;
  final List<EpisodeSource> sources;

  const DayCardNews({
    required this.id,
    required this.dayLabel,
    required this.cards,
    this.sources = const [],
  });
}

class CardNewsCard {
  final String imageUrl;
  final CardSlideMeta? meta;

  const CardNewsCard({required this.imageUrl, required this.meta});
}

class CardSlideMeta {
  final String type;
  final String title;
  final String body;
  final List<String> hashtags;
  final String? imageUrl;

  const CardSlideMeta({
    required this.type,
    required this.title,
    required this.body,
    required this.hashtags,
    this.imageUrl,
  });

  String get typeLabel {
    switch (type) {
      case 'cover':
        return 'COVER';
      case 'closing':
        return 'CLOSING';
      default:
        return 'TOPIC';
    }
  }

  factory CardSlideMeta.fromJson(Map<String, dynamic> json) {
    final hashtagsJson = json['hashtags'] as List<dynamic>? ?? const [];
    return CardSlideMeta(
      type: (json['type'] as String? ?? 'topic').trim(),
      title: (json['title'] as String? ?? '제목 없음').trim(),
      body: (json['body'] as String? ?? '').trim(),
      hashtags: hashtagsJson
          .map((item) => (item as String? ?? '').trim())
          .where((tag) => tag.isNotEmpty)
          .toList(),
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

class _CardNewsSlideView extends StatelessWidget {
  final CardNewsCard card;
  final int slideIndex;
  final int totalSlides;
  final List<EpisodeSource> sources;

  const _CardNewsSlideView({
    required this.card,
    required this.slideIndex,
    required this.totalSlides,
    this.sources = const [],
  });

  @override
  Widget build(BuildContext context) {
    final meta = card.meta;
    final summary = meta?.body.replaceAll('\n', ' ').trim() ?? '';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFEAE4D6),
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(30),
        child: Column(
          children: [
            Expanded(
              flex: 45,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(
                    color: const Color(0xFF171B15),
                    child: CachedNetworkImage(
                      imageUrl: card.imageUrl,
                      cacheManager: AppImageCacheManager.instance,
                      fit: BoxFit.cover,
                      alignment: Alignment.topCenter,
                      filterQuality: FilterQuality.high,
                      placeholder: (context, url) => const ColoredBox(
                        color: Color(0xFF171B15),
                      ),
                      errorWidget: (context, url, error) => const Center(
                        child: Text(
                          '이미지를 불러오지 못했습니다.',
                          style: TextStyle(color: Colors.white70),
                        ),
                      ),
                    ),
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color(0x0D000000),
                          Color(0x66000000),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 55,
              child: Container(
                width: double.infinity,
                color: const Color(0xFFEAE4D6),
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _CardBadge(label: meta?.typeLabel ?? 'CARD'),
                        const Spacer(),
                        _CardBadge(label: '${slideIndex + 1} / $totalSlides'),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            meta?.title ?? '카드뉴스',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFF141710),
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                              height: 1.18,
                            ),
                          ),
                        ),
                        if (sources.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(left: 4),
                            child: IconButton(
                              icon: const Icon(
                                Icons.link,
                                color: Color(0xFF2D3426),
                                size: 20,
                              ),
                              tooltip: '원문 출처',
                              padding: const EdgeInsets.all(4),
                              constraints: const BoxConstraints(
                                minWidth: 36,
                                minHeight: 36,
                              ),
                              onPressed: () => showSourceInfoBottomSheet(
                                context,
                                sources: sources,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: Text(
                        summary.isNotEmpty ? summary : '요약 본문이 없습니다.',
                        maxLines: 8,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF3D4335),
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          height: 1.58,
                        ),
                      ),
                    ),
                    if ((meta?.hashtags ?? const []).isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: meta!.hashtags
                            .take(3)
                            .map(
                              (tag) => _HashTagChip(
                                label: tag.startsWith('#') ? tag : '#$tag',
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardBadge extends StatelessWidget {
  final String label;

  const _CardBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF2D3426),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFFF3F0E8),
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _HashTagChip extends StatelessWidget {
  final String label;

  const _HashTagChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFDAD2BE),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFF4E5641),
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
