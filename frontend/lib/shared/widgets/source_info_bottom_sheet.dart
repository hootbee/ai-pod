//import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/episode_source.dart';
//import '../../services/network_cache_service.dart';

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

class SourceInfoBottomSheet extends StatefulWidget {
  final List<EpisodeSource> sources;
  final String? thumbnailUrl;

  const SourceInfoBottomSheet({
    super.key,
    required this.sources,
    this.thumbnailUrl,
  });

  @override
  State<SourceInfoBottomSheet> createState() => _SourceInfoBottomSheetState();
}

class _SourceInfoBottomSheetState extends State<SourceInfoBottomSheet> {
  bool _isExpanded = false;
  final int _initialCount = 5;

  @override
  Widget build(BuildContext context) {
    final maxHeight = MediaQuery.of(context).size.height * 0.8;
    
    final bool hasMore = widget.sources.length > _initialCount;

    final int displayCount = (_isExpanded || !hasMore) 
        ? widget.sources.length 
        : _initialCount;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: Color(0xFF1E211A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.link_rounded, color: Color(0xFFD6E36F), size: 24),
                const SizedBox(width: 10),
                const Text(
                  '원문 출처',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const Spacer(),
                Text(
                  '${widget.sources.length}개',
                  style: const TextStyle(color: Color(0xFFD6E36F), fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
              itemCount: displayCount + (hasMore && !_isExpanded ? 1 : 0),
              itemBuilder: (context, index) {
                if (hasMore && !_isExpanded && index == _initialCount) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: InkWell(
                      onTap: () => setState(() => _isExpanded = true),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '더보기',
                              style: const TextStyle(
                                color: Color(0xFFD6E36F),
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFFD6E36F)),
                          ],
                        ),
                      ),
                    ),
                  );
                }
                return _SourceItem(source: widget.sources[index]);
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

  const _SourceItem({required this.source});

  Future<void> _openUrl() async {
    final uri = Uri.tryParse(source.link);
    if (uri == null || source.link.isEmpty) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _openUrl,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: IntrinsicHeight( 
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 4,
                decoration: const BoxDecoration(
                  color: Color(0xFFD6E36F),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        source.source.toUpperCase(),
                        style: const TextStyle(
                          color: Color(0xFFD6E36F),
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        source.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(right: 12),
                child: Icon(Icons.chevron_right_rounded, color: Colors.white24),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/*class _SourcePlaceholder extends StatelessWidget {
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
}*/
