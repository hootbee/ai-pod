import 'package:flutter/material.dart';
import 'features/splash/splash_screen.dart'; // 스플래시 스크린 import 추가

void main() {
  runApp(const AipodApp());
}

class AipodApp extends StatelessWidget {
  const AipodApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'aipod',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: const Color(0xFF1E211A),
        colorScheme: const ColorScheme.dark(primary: Colors.white),
        fontFamily: 'Pretendard',
        useMaterial3: true,
      ),
      home: const SplashScreen(), // 여기를 SplashScreen으로 변경!
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
