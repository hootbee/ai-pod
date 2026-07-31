import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/splash/splash_screen.dart';
import 'package:frontend/main.dart';

void main() {
  testWidgets('앱 진입 시 스플래시 화면을 표시한다', (WidgetTester tester) async {
    await tester.pumpWidget(const AipodApp());

    expect(find.byType(SplashScreen), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 2600));
  });
}
