import 'package:flutter/material.dart';
import 'dart:async';
import '../../main.dart'; // MainScreenShell을 불러오기 위한 import

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // 2.5초 대기 후 메인 화면으로 부드럽게 전환
    Timer(const Duration(milliseconds: 2500), () {
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const MainScreenShell(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            // 페이드 인(Fade-in) 애니메이션 효과 적용
            return FadeTransition(opacity: animation, child: child);
          },
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E211A), // 이미지가 로딩되기 전이나 여백에 보일 배경색
      body: SizedBox(
        width: double.infinity,
        height: double.infinity,
        child: Image.asset(
          'assets/images/splash.png',
          fit: BoxFit.cover, // 이미지가 화면 비율에 맞춰 꽉 차도록 설정
        ),
      ),
    );
  }
}
