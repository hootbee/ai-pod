String formatPodcastScreenTitle({
  required String script,
  required String fallbackTitle,
  DateTime? createdAt,
}) {
  final scriptDate = RegExp(
    r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일',
  ).firstMatch(script);

  if (scriptDate != null) {
    return '${scriptDate.group(1)}년 ${scriptDate.group(2)}월 '
        '${scriptDate.group(3)}일 뉴스';
  }

  if (createdAt == null) return fallbackTitle;

  final localCreatedAt = createdAt.toLocal();
  return '${localCreatedAt.year}년 ${localCreatedAt.month}월 '
      '${localCreatedAt.day}일 뉴스';
}
