import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/auth/auth_service.dart';
import 'package:frontend/features/podcast/settings_screen.dart';

Widget _buildSettings({
  required Future<void> Function() onDeleteAccount,
  Future<void> Function()? onAccountDeleted,
}) {
  return MaterialApp(
    home: SettingsScreen(
      onLogout: () async {},
      onDeleteAccount: onDeleteAccount,
      onAccountDeleted: onAccountDeleted ?? () async {},
    ),
  );
}

Future<void> _openConfirmation(WidgetTester tester) async {
  await tester.tap(find.text('회원탈퇴').first);
  await tester.pumpAndSettle();
}

Future<void> _confirmDeletion(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(FilledButton, '회원탈퇴'));
  await tester.pump();
}

void main() {
  testWidgets('회원탈퇴 버튼은 확인 전 API를 호출하지 않는다', (tester) async {
    var deleteCalls = 0;
    await tester.pumpWidget(
      _buildSettings(
        onDeleteAccount: () async {
          deleteCalls++;
        },
      ),
    );

    expect(find.text('회원탈퇴'), findsOneWidget);

    await _openConfirmation(tester);

    expect(find.text('회원탈퇴를 진행할까요?'), findsOneWidget);
    expect(find.textContaining('되돌릴 수 없습니다'), findsOneWidget);
    expect(deleteCalls, 0);
  });

  testWidgets('회원탈퇴 확인을 취소하면 API를 호출하지 않는다', (tester) async {
    var deleteCalls = 0;
    await tester.pumpWidget(
      _buildSettings(
        onDeleteAccount: () async {
          deleteCalls++;
        },
      ),
    );

    await _openConfirmation(tester);
    await tester.tap(find.widgetWithText(TextButton, '취소'));
    await tester.pumpAndSettle();

    expect(deleteCalls, 0);
    expect(find.text('회원탈퇴를 진행할까요?'), findsNothing);
  });

  testWidgets('최종 확인 시 한 번만 호출하고 처리 중 중복 요청을 막는다', (tester) async {
    final deletion = Completer<void>();
    var deleteCalls = 0;
    var deletedCalls = 0;
    await tester.pumpWidget(
      _buildSettings(
        onDeleteAccount: () {
          deleteCalls++;
          return deletion.future;
        },
        onAccountDeleted: () async {
          deletedCalls++;
        },
      ),
    );

    await _openConfirmation(tester);
    await _confirmDeletion(tester);

    expect(deleteCalls, 1);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.tap(find.text('회원탈퇴').first, warnIfMissed: false);
    await tester.pump();
    expect(deleteCalls, 1);

    deletion.complete();
    await tester.pumpAndSettle();
    expect(deletedCalls, 1);
  });

  testWidgets('성공하면 기존 화면 스택을 제거하고 로그인 화면으로 이동한다', (tester) async {
    late BuildContext navigationContext;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            navigationContext = context;
            return SettingsScreen(
              onLogout: () async {},
              onDeleteAccount: () async {},
              onAccountDeleted: () async {
                Navigator.of(navigationContext).pushAndRemoveUntil(
                  MaterialPageRoute<void>(
                    builder: (_) => const Scaffold(body: Text('로그인 화면')),
                  ),
                  (_) => false,
                );
              },
            );
          },
        ),
      ),
    );

    await _openConfirmation(tester);
    await _confirmDeletion(tester);
    await tester.pumpAndSettle();

    expect(find.text('로그인 화면'), findsOneWidget);
    expect(find.byType(SettingsScreen), findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('로그인 화면'), findsOneWidget);
  });

  testWidgets('실패를 안내하고 다시 시도할 수 있다', (tester) async {
    var deleteCalls = 0;
    var deletedCalls = 0;
    await tester.pumpWidget(
      _buildSettings(
        onDeleteAccount: () async {
          deleteCalls++;
          if (deleteCalls == 1) throw Exception('network error');
        },
        onAccountDeleted: () async {
          deletedCalls++;
        },
      ),
    );

    await _openConfirmation(tester);
    await _confirmDeletion(tester);
    await tester.pumpAndSettle();

    expect(find.text('회원탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.'), findsOneWidget);
    expect(deleteCalls, 1);
    expect(deletedCalls, 0);

    await _openConfirmation(tester);
    await _confirmDeletion(tester);
    await tester.pumpAndSettle();

    expect(deleteCalls, 2);
    expect(deletedCalls, 1);
  });

  testWidgets('서버 탈퇴 후 로컬 정리가 실패하면 안내 후 세션을 종료한다', (tester) async {
    var deletedCalls = 0;
    await tester.pumpWidget(
      _buildSettings(
        onDeleteAccount: () async {
          throw const AccountDeletionCleanupException();
        },
        onAccountDeleted: () async {
          deletedCalls++;
        },
      ),
    );

    await _openConfirmation(tester);
    await _confirmDeletion(tester);
    await tester.pumpAndSettle();

    expect(find.text('기기 데이터 정리가 필요합니다'), findsOneWidget);
    expect(find.textContaining('회원탈퇴는 완료됐지만'), findsOneWidget);
    expect(deletedCalls, 0);

    await tester.tap(find.widgetWithText(FilledButton, '확인'));
    await tester.pumpAndSettle();

    expect(deletedCalls, 1);
    expect(find.text('기기 데이터 정리가 필요합니다'), findsNothing);
  });
}
