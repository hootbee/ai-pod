import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/app_config.dart';

class CardNewsScreen extends StatefulWidget {
  const CardNewsScreen({super.key});

  @override
  State<CardNewsScreen> createState() => _CardNewsScreenState();
}

class _CardNewsScreenState extends State<CardNewsScreen> {
  bool _loading = true;
  String? _error;
  List<DayCardNews> _days = [];
  final Map<int, PageController> _slideControllers = {};

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
      final episodesRes = await http
          .get(Uri.parse('${AppConfig.apiBaseUrl}/episodes'))
          .timeout(const Duration(seconds: 10));

      if (episodesRes.statusCode != 200) {
        throw Exception('episodes API 실패: ${episodesRes.statusCode}');
      }

      final episodes = jsonDecode(episodesRes.body) as List<dynamic>;
      if (episodes.isEmpty) {
        throw Exception('에피소드가 없습니다.');
      }

      final days = <DayCardNews>[];
      for (final rawEpisode in episodes) {
        final episode = Map<String, dynamic>.from(rawEpisode as Map);
        final episodeId = episode['id'] as String?;
        if (episodeId == null || episodeId.isEmpty) continue;

        final cardNewsRes = await http
            .get(Uri.parse('${AppConfig.apiBaseUrl}/card-news/$episodeId'))
            .timeout(const Duration(seconds: 10));

        if (cardNewsRes.statusCode != 200) {
          continue;
        }

        final cardNewsList = jsonDecode(cardNewsRes.body) as List<dynamic>;
        if (cardNewsList.isEmpty) {
          continue;
        }

        final latestCardNews = Map<String, dynamic>.from(
          cardNewsList.first as Map,
        );
        final imagePathsJson = latestCardNews['imagePaths'] as List<dynamic>?;
        if (imagePathsJson == null || imagePathsJson.isEmpty) {
          continue;
        }

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
          cards.add(CardNewsCard(imageUrl: imageUrls[i], meta: meta));
        }

        final createdAt =
            (episode['createdAt'] as String?) ??
            (latestCardNews['createdAt'] as String?) ??
            '';
        days.add(DayCardNews(dayLabel: _toDayLabel(createdAt), cards: cards));
      }

      if (days.isEmpty) {
        throw Exception('카드뉴스 이미지가 없습니다.');
      }

      if (!mounted) return;
      setState(() {
        _days = days;
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

  PageController _slideControllerForDay(int dayIndex) {
    return _slideControllers.putIfAbsent(
      dayIndex,
      () => PageController(viewportFraction: 0.86),
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

    return PageView.builder(
      scrollDirection: Axis.vertical,
      itemCount: _days.length,
      itemBuilder: (context, dayIndex) {
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
                itemCount: day.cards.length,
                itemBuilder: (context, slideIndex) {
                  final card = day.cards[slideIndex];
                  return Container(
                    margin: const EdgeInsets.symmetric(
                      horizontal: 12.0,
                      vertical: 24.0,
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF2B3025),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(24),
                              child: ColoredBox(
                                color: const Color(0xFF111111),
                                child: Image.network(
                                  card.imageUrl,
                                  fit: BoxFit.contain,
                                  alignment: Alignment.center,
                                  filterQuality: FilterQuality.high,
                                  errorBuilder: (context, error, stackTrace) {
                                    return const Center(
                                      child: Text(
                                        '이미지를 불러오지 못했습니다.',
                                        style: TextStyle(color: Colors.white70),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),
                          ),
                          Positioned.fill(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(24),
                                gradient: const LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.transparent,
                                    Color(0xCC000000),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            left: 16,
                            right: 16,
                            bottom: 16,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (card.meta != null) ...[
                                  Text(
                                    card.meta!.typeLabel,
                                    style: const TextStyle(
                                      color: Color(0xFFE0E6D4),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    card.meta!.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800,
                                      height: 1.2,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                ],
                                Text(
                                  '${slideIndex + 1} / ${day.cards.length}',
                                  style: const TextStyle(
                                    color: Color(0xFFE0E6D4),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
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
  final String dayLabel;
  final List<CardNewsCard> cards;

  const DayCardNews({required this.dayLabel, required this.cards});
}

class CardNewsCard {
  final String imageUrl;
  final CardSlideMeta? meta;

  const CardNewsCard({required this.imageUrl, required this.meta});
}

class CardSlideMeta {
  final String type;
  final String title;

  const CardSlideMeta({required this.type, required this.title});

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
    return CardSlideMeta(
      type: (json['type'] as String? ?? 'topic').trim(),
      title: (json['title'] as String? ?? '제목 없음').trim(),
    );
  }
}
