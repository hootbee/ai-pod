import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/shared/models/episode_source.dart';
import 'package:frontend/shared/widgets/source_info_bottom_sheet.dart';

void main() {
  testWidgets('출처 바텀 시트가 시스템 하단 인셋을 확보한다', (tester) async {
    const bottomInset = 34.0;

    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: const MediaQueryData(
            size: Size(400, 800),
            padding: EdgeInsets.only(bottom: bottomInset),
          ),
          child: child!,
        ),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showSourceInfoBottomSheet(
                context,
                sources: const [
                  EpisodeSource(
                    title: '테스트 출처',
                    source: 'AIPOD',
                    link: 'https://example.com',
                  ),
                ],
              ),
              child: const Text('출처 열기'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('출처 열기'));
    await tester.pumpAndSettle();

    final safeAreaFinder = find.ancestor(
      of: find.byType(SourceInfoBottomSheet),
      matching: find.byType(SafeArea),
    );
    final safeArea = tester.widget<SafeArea>(safeAreaFinder);

    expect(safeArea.top, isFalse);
    expect(safeArea.bottom, isTrue);
    expect(
      find.descendant(
        of: safeAreaFinder,
        matching: find.byWidgetPredicate(
          (widget) =>
              widget is Padding &&
              widget.padding == const EdgeInsets.only(bottom: bottomInset),
        ),
      ),
      findsOneWidget,
    );
  });
}
