import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'features/splash/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kIsWeb) {
    await JustAudioBackground.init(
      androidNotificationChannelId: 'com.aipod.channel.audio',
      androidNotificationChannelName: 'AIPod 오디오',
      androidNotificationOngoing: true,
    );
  }
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
