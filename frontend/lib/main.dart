import 'package:flutter/material.dart';

void main() {
  runApp(const AipodApp());
}

class AipodApp extends StatelessWidget {
  const AipodApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'aipod',
      debugShowCheckedModeBanner: false, // 오른쪽 위 Debug 띠 제거
      theme: ThemeData(
        // 피그마 디자인을 참고한 전체적인 다크 테마 기반 설정
        scaffoldBackgroundColor: const Color(
          0xFF1E211A,
        ), // 임의의 어두운 배경색 (피그마 색상 코드로 나중에 변경)
        colorScheme: const ColorScheme.dark(primary: Colors.white),
        fontFamily: 'Pretendard', // 나중에 폰트 추가 시 사용할 이름
        useMaterial3: true,
      ),
      home: const MainScreenShell(),
    );
  }
}

// 테스트를 위한 임시 메인 화면 껍데기
class MainScreenShell extends StatelessWidget {
  const MainScreenShell({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text(
          'aipod 준비 완료 🚀',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
