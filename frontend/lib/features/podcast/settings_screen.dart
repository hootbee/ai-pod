import 'package:flutter/material.dart';

import '../../shared/theme/app_theme_controller.dart';

class SettingsScreen extends StatelessWidget {
  final Future<void> Function() onLogout;

  const SettingsScreen({super.key, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: AppThemeController.isLightMode,
      builder: (context, isLightMode, _) {
        return Scaffold(
          backgroundColor: AppThemeController.backgroundColor,
          body: SafeArea(
            child: Column(
              children: [
                _SettingsHeader(
                  title: '설정',
                  onBack: () => Navigator.of(context).pop(),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 18, 24, 32),
                    children: [
                      _SettingsToggleTile(
                        icon: Icons.light_mode_rounded,
                        title: '라이트 모드',
                        subtitle: '밝은 화면 테마',
                        value: isLightMode,
                        onChanged: (value) {
                          AppThemeController.isLightMode.value = value;
                        },
                      ),
                      const SizedBox(height: 12),
                      _SettingsActionTile(
                        icon: Icons.download_done_rounded,
                        title: '오프라인 저장 컨텐츠',
                        subtitle: '저장한 에피소드가 여기에 표시됩니다',
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const OfflineContentScreen(),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      _SettingsActionTile(
                        icon: Icons.logout_rounded,
                        title: '로그아웃',
                        subtitle: '현재 계정에서 로그아웃합니다',
                        iconColor: const Color(0xFFFF6B6B),
                        titleColor: const Color(0xFFFF6B6B),
                        trailing: const SizedBox.shrink(),
                        onTap: () {
                          onLogout();
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class OfflineContentScreen extends StatelessWidget {
  const OfflineContentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // TODO: 저장된 오프라인 에피소드 목록을 로컬 캐시/DB에서 불러와 표시하기.
    return ValueListenableBuilder<bool>(
      valueListenable: AppThemeController.isLightMode,
      builder: (context, _, __) {
        return Scaffold(
          backgroundColor: AppThemeController.backgroundColor,
          body: SafeArea(
            child: Column(
              children: [
                _SettingsHeader(
                  title: '오프라인 저장 컨텐츠',
                  onBack: () => Navigator.of(context).pop(),
                ),
                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              color: AppThemeController.secondaryTextColor(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.download_done_rounded,
                              color:
                                  AppThemeController.secondaryTextColor(0.42),
                              size: 34,
                            ),
                          ),
                          const SizedBox(height: 18),
                          Text(
                            '비어있습니다',
                            style: TextStyle(
                              color: AppThemeController.primaryTextColor,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '오프라인으로 저장한 컨텐츠가 아직 없습니다',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color:
                                  AppThemeController.secondaryTextColor(0.48),
                              fontSize: 14,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SettingsHeader extends StatelessWidget {
  final String title;
  final VoidCallback onBack;

  const _SettingsHeader({required this.title, required this.onBack});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 12, 24, 12),
      child: SizedBox(
        height: 48,
        child: Row(
          children: [
            Material(
              color: AppThemeController.secondaryTextColor(0.12),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onBack,
                child: SizedBox(
                  width: 42,
                  height: 42,
                  child: Icon(
                    Icons.arrow_back_ios_new_rounded,
                    color: AppThemeController.primaryTextColor,
                    size: 21,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppThemeController.primaryTextColor,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SettingsToggleTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SettingsToggleTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return _SettingsTileShell(
      icon: icon,
      title: title,
      subtitle: subtitle,
      trailing: Switch(
        value: value,
        activeThumbColor: const Color(0xFFD6E36F),
        activeTrackColor: const Color(0xFFD6E36F).withValues(alpha: 0.32),
        inactiveThumbColor: AppThemeController.secondaryTextColor(0.75),
        inactiveTrackColor: AppThemeController.controlFillColor,
        onChanged: onChanged,
      ),
    );
  }
}

class _SettingsActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color? iconColor;
  final Color? titleColor;
  final Widget? trailing;

  const _SettingsActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.iconColor,
    this.titleColor,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: _SettingsTileShell(
          icon: icon,
          title: title,
          subtitle: subtitle,
          iconColor: iconColor,
          titleColor: titleColor,
          trailing: trailing ??
              Icon(
                Icons.chevron_right_rounded,
                color: AppThemeController.secondaryTextColor(0.35),
                size: 24,
              ),
        ),
      ),
    );
  }
}

class _SettingsTileShell extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget trailing;
  final Color? iconColor;
  final Color? titleColor;

  const _SettingsTileShell({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.iconColor,
    this.titleColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 78),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: AppThemeController.elevatedSurfaceColor,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppThemeController.surfaceBorderColor),
        boxShadow: AppThemeController.raisedShadow,
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppThemeController.controlFillColor,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: iconColor ?? AppThemeController.primaryTextColor,
              size: 21,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: titleColor ?? AppThemeController.primaryTextColor,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppThemeController.secondaryTextColor(0.48),
                    fontSize: 13,
                    height: 1.25,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          trailing,
        ],
      ),
    );
  }
}
