import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../auth/auth_service.dart';
import '../podcast/main_screen.dart'; // 로그인 성공 시 이동할 메인 화면

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isLoading = false; // API 통신 중 로딩 상태를 관리할 변수

  // 1. 구글 로그인 API 연동
  Future<void> _handleGoogleLogin() async {
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
          content: Text('로그인 실패: $e'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
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
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 40.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 2), // 상단 여백 (비율로 공간 차지)
              // 중앙 로고 영역 (다이얼 + 텍스트)
              Center(
                child: Column(
                  children: [
                    // 로고 아이콘 (다이얼 모형)
                    Container(
                      width: 140,
                      height: 140,
                      decoration: const BoxDecoration(
                        color: Color(0xFFE2E2E2),
                        shape: BoxShape.circle,
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Container(
                            width: 60,
                            height: 60,
                            decoration: const BoxDecoration(
                              color: backgroundColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          Positioned(
                            top: 12,
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.15),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    // aipod 텍스트
                    const Text(
                      'aipod',
                      style: TextStyle(
                        fontSize: 48,
                        color: Colors.white,
                        fontWeight: FontWeight.w400,
                        letterSpacing: -1.5,
                      ),
                    ),
                  ],
                ),
              ),

              const Spacer(flex: 3), // 로고와 버튼 사이의 넉넉한 여백
              // 하단 로그인 버튼 영역
              if (_isLoading)
                const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                )
              else
                Column(
                  children: [
                    // 구글 로그인 버튼
                    _buildLoginButton(
                      icon: FontAwesomeIcons.google,
                      iconColor: Colors.blue, // 구글은 보통 컬러 로고를 씁니다
                      text: 'Google로 계속하기',
                      onPressed: _handleGoogleLogin,
                    ),
                    const SizedBox(height: 16),
                    // 애플 로그인 버튼
                    _buildLoginButton(
                      icon: FontAwesomeIcons.apple,
                      iconColor: Colors.black,
                      text: 'Apple로 계속하기',
                      onPressed: _handleAppleLogin,
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
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
