import 'package:just_audio/just_audio.dart';

class AudioHandler {
  static final AudioHandler instance = AudioHandler._internal();
  AudioHandler._internal();

  final AudioPlayer player = AudioPlayer();
  String? currentEpisodeId;
}