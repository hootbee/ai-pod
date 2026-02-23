import 'package:flutter/material.dart';
import '../auth/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final AuthService _authService = AuthService();
  bool _isLoading = false;
  String? _error;
  Map<String, dynamic>? _userInfo;

  Future<void> _handleLogin() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      await _authService.loginWithGoogle();
      final me = await _authService.getMe();
      setState(() { _userInfo = me; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _isLoading = false; });
    }
  }

  Future<void> _handleLogout() async {
    setState(() { _isLoading = true; });
    try {
      await _authService.logout();
      setState(() { _userInfo = null; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AiPod 로그인 테스트')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_isLoading)
                const CircularProgressIndicator()
              else if (_userInfo != null) ...[
                const Icon(Icons.check_circle, color: Colors.green, size: 64),
                const SizedBox(height: 16),
                Text('로그인 성공!', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text('User ID: ${_userInfo!['userId']}'),
                Text('Email: ${_userInfo!['email']}'),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _handleLogout,
                  icon: const Icon(Icons.logout),
                  label: const Text('로그아웃'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                ),
              ] else ...[
                const Icon(Icons.account_circle, size: 80, color: Colors.grey),
                const SizedBox(height: 24),
                if (_error != null) ...[
                  Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                  const SizedBox(height: 16),
                ],
                ElevatedButton.icon(
                  onPressed: _handleLogin,
                  icon: Image.network(
                    'https://developers.google.com/identity/images/g-logo.png',
                    height: 20,
                  ),
                  label: const Text('Google로 로그인'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black87,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
