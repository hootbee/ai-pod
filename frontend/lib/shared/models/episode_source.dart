class EpisodeSource {
  final String title;
  final String source;
  final String link;

  const EpisodeSource({
    required this.title,
    required this.source,
    required this.link,
  });

  factory EpisodeSource.fromJson(Map<String, dynamic> json) {
    return EpisodeSource(
      title: (json['title'] as String? ?? '').trim(),
      source: (json['source'] as String? ?? '').trim(),
      link: (json['link'] as String? ?? '').trim(),
    );
  }
}
