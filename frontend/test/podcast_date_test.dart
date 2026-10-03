import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/podcast/podcast_date.dart';

void main() {
  test('스크립트의 날짜를 플레이어 헤더에 사용한다', () {
    const script = 'narrator: 2026년 8월 10일 월요일, 오늘의 주요 소식입니다.';

    final title = formatPodcastScreenTitle(
      script: script,
      fallbackTitle: '테크 인사이트',
      createdAt: DateTime.utc(2026, 8, 9, 19),
    );

    expect(title, '2026년 8월 10일 뉴스');
  });

  test('스크립트에 날짜가 없고 생성일도 없으면 제목을 사용한다', () {
    expect(
      formatPodcastScreenTitle(
        script: 'narrator: 오늘의 주요 소식입니다.',
        fallbackTitle: '테크 인사이트',
      ),
      '테크 인사이트',
    );
  });

  test('콘텐츠 날짜는 로컬(KST) 기준으로 표시한다', () {
    // 04:00 KST pipeline run is stored as 19:00 UTC on the previous day.
    final label = formatContentDate(DateTime.utc(2026, 10, 1, 19));
    final expected = DateTime.utc(2026, 10, 1, 19).toLocal();
    expect(
      label,
      '${expected.year}.${expected.month.toString().padLeft(2, '0')}.'
      '${expected.day.toString().padLeft(2, '0')}',
    );
    expect(formatContentDate(DateTime(2026, 3, 5)), '2026.03.05');
  });
}
