import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../auth/auth_service.dart';
import '../podcast/main_screen.dart'; // 로그인 성공 시 이동할 메인 화면
import 'google_sign_in_web_button_stub.dart'
    if (dart.library.html) 'google_sign_in_web_button.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isLoading = false; // API 통신 중 로딩 상태를 관리할 변수
  StreamSubscription<GoogleSignInAccount?>? _googleUserSub;
  bool _googleLoginInProgress = false;

  @override
  void initState() {
    super.initState();
    if (kIsWeb) {
      _googleUserSub = AuthService.googleSignIn.onCurrentUserChanged.listen((
        account,
      ) {
        if (account == null) return;
        unawaited(_completeGoogleLogin(account));
      });
    }
  }

  @override
  void dispose() {
    _googleUserSub?.cancel();
    super.dispose();
  }

  // 1. 구글 로그인 API 연동
  Future<void> _handleGoogleLogin() async {
    if (_googleLoginInProgress) return;
    setState(() => _isLoading = true);

    try {
      final authService = AuthService();
      await authService.loginWithGoogle(); // 구글 OAuth + 백엔드 JWT 발급
      if (!mounted) return;
      _navigateToMain();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('로그인 실패: ${_formatLoginError(e)}'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _completeGoogleLogin(GoogleSignInAccount account) async {
    if (_googleLoginInProgress || !mounted) return;
    _googleLoginInProgress = true;
    if (mounted) setState(() => _isLoading = true);

    try {
      await AuthService().loginWithGoogleAccount(account);
      if (!mounted) return;
      _navigateToMain();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Google 로그인 실패: ${_formatLoginError(e)}'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      _googleLoginInProgress = false;
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatLoginError(Object error) {
    final message = error.toString();
    if (message.contains('로그인 실패')) {
      return message.replaceFirst('Exception: ', '');
    }
    if (message.contains('TimeoutException')) {
      return '로그인 요청이 너무 오래 걸렸습니다. 네트워크와 Google 설정을 확인한 뒤 다시 시도해 주세요.';
    }
    if (message.contains('popup_closed')) {
      return '로그인 창이 닫혔습니다. 다시 시도해 주세요.';
    }
    if (message.contains('access_denied')) {
      return 'Google 계정 접근이 거부되었습니다.';
    }
    return '로그인 처리 중 오류가 발생했습니다.\n$message';
  }

  // 2. 애플 로그인 API 연동을 위한 뼈대 함수
  Future<void> _handleAppleLogin() async {
    setState(() => _isLoading = true);

    // TODO: 나중에 여기에 실제 애플 OAuth API 통신 코드가 들어갑니다.
    await Future.delayed(const Duration(milliseconds: 1500));

    setState(() => _isLoading = false);
    _navigateToMain();
  }

  // 로그인 성공 시 메인 화면으로 넘어가는 함수
  void _navigateToMain() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const MainScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    const backgroundColor = Color(0xFF1E211A); // 피그마 배경색

    return Scaffold(
      backgroundColor: backgroundColor,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset('assets/images/login_screen.png', fit: BoxFit.cover),
          SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
                child: _buildLoginActions(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginActions() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildGoogleLoginButton(),
        const SizedBox(height: 16),
        _buildLoginButton(
          icon: FontAwesomeIcons.apple,
          iconColor: Colors.black,
          text: 'Apple로 계속하기',
          onPressed: _handleAppleLogin,
        ),
      ],
    );
  }

  Widget _buildGoogleLoginButton() {
    if (kIsWeb) {
      return Stack(
        alignment: Alignment.center,
        children: [
          _buildLoginButton(
            icon: FontAwesomeIcons.google,
            iconColor: Colors.blue,
            text: 'Google로 계속하기',
            onPressed: () {},
          ),
          const Positioned.fill(
            child: Opacity(opacity: 0.02, child: GoogleSignInWebButton()),
          ),
        ],
      );
    }

    return _buildLoginButton(
      icon: FontAwesomeIcons.google,
      iconColor: Colors.blue,
      text: 'Google로 계속하기',
      onPressed: _handleGoogleLogin,
    );
  }

  // 반복되는 버튼 UI를 깔끔하게 분리한 커스텀 위젯 함수
  Widget _buildLoginButton({
    required IconData icon,
    required Color iconColor,
    required String text,
    required VoidCallback onPressed,
  }) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black, // 버튼 클릭 시 물결 효과 색상
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: iconColor, size: 24),
          const SizedBox(width: 12),
          Text(
            text,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.black,
            ),
          ),
        ],
      ),
    );
  }
}
