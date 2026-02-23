import 'package:flutter/material.dart';
import 'features/splash/splash_screen.dart';

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
      home: const SplashScreen(),
    );
  }
}
