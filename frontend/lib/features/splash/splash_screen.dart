import 'package:flutter/material.dart';
import 'dart:async';
import '../auth/auth_service.dart';
import '../auth/login_screen.dart';
import '../podcast/main_screen.dart';
import '../../services/app_update_service.dart';
import '../../shared/models/app_update_info.dart';
import 'package:url_launcher/url_launcher.dart';

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
    AppUpdateInfo? updateInfo;

    try {
      final results = await Future.wait([
        Future.delayed(const Duration(milliseconds: 2500)),
        _tryAutoLoginSafely(),
        AppUpdateService.instance.checkForUpdate(),
      ]);
      isLoggedIn = results[1] as bool;
      updateInfo = results[2] as AppUpdateInfo?;
    } catch (e, stackTrace) {
      debugPrint('Splash init failed: $e');
      debugPrintStack(stackTrace: stackTrace);
    }

    if (!mounted) return;

    final pendingUpdate = updateInfo;
    if (pendingUpdate != null) {
      await _showUpdateDialog(pendingUpdate);
      if (!mounted || pendingUpdate.requiresUpdate) return;
    }

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            isLoggedIn ? const MainScreen() : const LoginScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  Future<void> _showUpdateDialog(AppUpdateInfo info) async {
    final isRequired = info.requiresUpdate || info.forceUpdate;
    await showDialog<void>(
      context: context,
      barrierDismissible: !isRequired,
      builder: (context) {
        return PopScope(
          canPop: !isRequired,
          child: AlertDialog(
            title: Text(isRequired ? '업데이트가 필요합니다' : '새 버전이 있습니다'),
            content: Text(
              isRequired
                  ? '더 안정적인 서비스 이용을 위해 최신 버전으로 업데이트해 주세요.'
                  : '새로운 버전이 출시되었습니다. 지금 업데이트하시겠습니까?',
            ),
            actions: [
              if (!isRequired)
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('나중에'),
                ),
              FilledButton(
                onPressed: () async {
                  final uri = Uri.tryParse(info.storeUrl);
                  if (uri == null || !await launchUrl(uri)) return;
                  if (!isRequired && context.mounted) {
                    Navigator.of(context).pop();
                  }
                },
                child: const Text('업데이트'),
              ),
            ],
          ),
        );
      },
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
        child: Image.asset('assets/images/splash.png', fit: BoxFit.cover),
      ),
    );
  }
}
