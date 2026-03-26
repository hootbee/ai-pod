import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/episode_source.dart';
import '../../services/network_cache_service.dart';

void showSourceInfoBottomSheet(
  BuildContext context, {
  required List<EpisodeSource> sources,
  String? thumbnailUrl,
}) {
  if (sources.isEmpty) return;

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => SourceInfoBottomSheet(
      sources: sources,
      thumbnailUrl: thumbnailUrl,
    ),
  );
}

class SourceInfoBottomSheet extends StatelessWidget {
  final List<EpisodeSource> sources;
  final String? thumbnailUrl;

  const SourceInfoBottomSheet({
    super.key,
    required this.sources,
    this.thumbnailUrl,
  });

  @override
  Widget build(BuildContext context) {
    final maxHeight = MediaQuery.of(context).size.height * 0.75;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: Color(0xFF2A2D24),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 드래그 핸들
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 8),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // 헤더
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Row(
              children: [
                Icon(Icons.link, color: Color(0xFFD6E36F), size: 18),
                SizedBox(width: 8),
                Text(
                  '원문 출처',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Colors.white12),
          // 출처 목록
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              itemCount: sources.length,
              separatorBuilder: (_, __) => const SizedBox(height: 20),
              itemBuilder: (context, index) {
                final src = sources[index];
                return _SourceItem(
                  source: src,
                  thumbnailUrl: thumbnailUrl,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SourceItem extends StatelessWidget {
  final EpisodeSource source;
  final String? thumbnailUrl;

  const _SourceItem({required this.source, this.thumbnailUrl});

  Future<void> _openUrl() async {
    final uri = Uri.tryParse(source.link);
    if (uri == null || source.link.isEmpty) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 썸네일
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 80,
                height: 80,
                child: thumbnailUrl != null
                    ? CachedNetworkImage(
                        imageUrl: thumbnailUrl!,
                        cacheManager: AppImageCacheManager.instance,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => const ColoredBox(
                          color: Color(0xFF3A3E33),
                        ),
                        errorWidget: (_, __, ___) =>
                            _SourcePlaceholder(source: source.source),
                      )
                    : _SourcePlaceholder(source: source.source),
              ),
            ),
            const SizedBox(width: 14),
            // 제목 + 출처명
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    source.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.public, color: Color(0xFF9CA38F), size: 12),
                      const SizedBox(width: 4),
                      Text(
                        source.source,
                        style: const TextStyle(
                          color: Color(0xFF9CA38F),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // 원문 읽기 버튼
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: source.link.isNotEmpty ? _openUrl : null,
            icon: const Icon(Icons.open_in_new, size: 16),
            label: const Text('기사 전문 보러 가기'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD6E36F),
              foregroundColor: const Color(0xFF1E211A),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              textStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SourcePlaceholder extends StatelessWidget {
  final String source;

  const _SourcePlaceholder({required this.source});

  @override
  Widget build(BuildContext context) {
    final initial = source.isNotEmpty ? source[0].toUpperCase() : '?';
    return ColoredBox(
      color: const Color(0xFF3A3E33),
      child: Center(
        child: Text(
          initial,
          style: const TextStyle(
            color: Color(0xFF9CA38F),
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
