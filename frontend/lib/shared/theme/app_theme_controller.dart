import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class AppThemeController {
  AppThemeController._();

  static final ValueNotifier<bool> isLightMode = ValueNotifier<bool>(false);

  static const Color _lightBackground = Color(0xFFE8EEDC);
  static const Color _lightSurface = Color(0xFFFCFDF8);
  static const Color _lightSurfaceRaised = Color(0xFFFFFFFF);
  static const Color _lightPrimaryText = Color(0xFF252B1F);
  static const Color _lightAccent = Color(0xFF6D7D22);
  static const Color _darkBackground = Color(0xFF1E211A);
  static const Color _darkSurface = Color(0xFF434A38);

  static Color get backgroundColor =>
      isLightMode.value ? _lightBackground : _darkBackground;

  static Color get surfaceColor =>
      isLightMode.value ? _lightSurface : _darkSurface;

  static Color get elevatedSurfaceColor =>
      isLightMode.value ? _lightSurfaceRaised : _darkSurface;

  static Color get surfaceBorderColor =>
      isLightMode.value ? const Color(0xFFC9D2B8) : Colors.white10;

  static Color get controlFillColor =>
      isLightMode.value ? const Color(0xFFDDE7CA) : Colors.white12;

  static Color get navBarColor =>
      isLightMode.value ? const Color(0xFFEEF4E1) : const Color(0xFF50583D);

  static Color get navSelectedColor =>
      isLightMode.value ? const Color(0xFF6D7D22) : const Color(0xFFA1A98F);

  static Color get navSelectedTextColor =>
      isLightMode.value ? Colors.white : const Color(0xFFB8FF00);

  static Color get accentColor =>
      isLightMode.value ? _lightAccent : const Color(0xFFD6E36F);

  static List<BoxShadow> get raisedShadow => isLightMode.value
      ? [
          BoxShadow(
            color: const Color(0xFF44502F).withValues(alpha: 0.12),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ]
      : const [];

  static Color get primaryTextColor =>
      isLightMode.value ? _lightPrimaryText : Colors.white;

  static Color secondaryTextColor(double alpha) =>
      primaryTextColor.withValues(alpha: alpha);
}
