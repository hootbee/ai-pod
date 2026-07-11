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
    // 어떤 예외가 나도 앱이 로딩 화면에 갇히지 않도록 로그인 화면으로 안전하게 이동한다.
    bool isLoggedIn = false;

    try {
      final results = await Future.wait([
        Future.delayed(const Duration(milliseconds: 2500)),
        _tryAutoLoginSafely(),
      ]);
      isLoggedIn = results[1] as bool;
    } catch (e, stackTrace) {
      debugPrint('Splash init failed: $e');
      debugPrintStack(stackTrace: stackTrace);
    }

    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            isLoggedIn ? const MainScreen() : const LoginScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  Future<bool> _tryAutoLoginSafely() async {
    try {
      return await AuthService().tryAutoLogin();
    } catch (e, stackTrace) {
      debugPrint('Auto login failed: $e');
      debugPrintStack(stackTrace: stackTrace);
      return false;
    }
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
