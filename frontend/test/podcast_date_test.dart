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
}
