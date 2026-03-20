import 'package:flutter/material.dart';
import 'dart:async';
import '../auth/auth_service.dart';
import '../auth/login_screen.dart';
import '../podcast/main_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    // 스플래시 최소 노출(2.5초)과 자동 로그인 체크를 동시에 실행
    final results = await Future.wait([
      Future.delayed(const Duration(milliseconds: 2500)),
      AuthService().tryAutoLogin(),
    ]);

    if (!mounted) return;

    final isLoggedIn = results[1] as bool;

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            isLoggedIn ? const MainScreen() : const LoginScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E211A),
      body: SizedBox(
        width: double.infinity,
        height: double.infinity,
        child: Image.asset(
          'assets/images/splash.png',
          fit: BoxFit.cover,
        ),
      ),
    );
  }
}
