import 'package:flutter/material.dart';

import '../../shared/theme/app_theme_controller.dart';
import '../auth/auth_service.dart';

class SettingsScreen extends StatefulWidget {
  final Future<void> Function() onLogout;
  final Future<void> Function() onDeleteAccount;
  final Future<void> Function() onAccountDeleted;

  const SettingsScreen({
    super.key,
    required this.onLogout,
    required this.onDeleteAccount,
    required this.onAccountDeleted,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _isAccountDeletionDialogOpen = false;
  bool _isDeletingAccount = false;

  Future<void> _confirmAndDeleteAccount() async {
    if (_isAccountDeletionDialogOpen || _isDeletingAccount) return;

    _isAccountDeletionDialogOpen = true;
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('회원탈퇴를 진행할까요?'),
        content: const Text(
          '회원탈퇴 시 계정과 로그인 정보, 재생 기록, 카드뉴스 기록이 삭제되며 되돌릴 수 없습니다.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('취소'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFF6B6B),
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('회원탈퇴'),
          ),
        ],
      ),
    );
    _isAccountDeletionDialogOpen = false;
    if (!mounted || confirmed != true || _isDeletingAccount) return;

    setState(() => _isDeletingAccount = true);
    try {
      await widget.onDeleteAccount();
    } on AccountDeletionCleanupException {
      if (!mounted) return;
      setState(() => _isDeletingAccount = false);
      await _showCleanupFailureDialog();
      if (!mounted) return;
      setState(() => _isDeletingAccount = true);
      await widget.onAccountDeleted();
      if (mounted) setState(() => _isDeletingAccount = false);
      return;
    } catch (_) {
      if (!mounted) return;
      setState(() => _isDeletingAccount = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('회원탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.')),
        );
      return;
    }

    if (!mounted) return;
    await widget.onAccountDeleted();
    if (mounted) setState(() => _isDeletingAccount = false);
  }

  Future<void> _showCleanupFailureDialog() {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => PopScope(
        canPop: false,
        child: AlertDialog(
          title: const Text('기기 데이터 정리가 필요합니다'),
          content: const Text(
            '회원탈퇴는 완료됐지만 기기의 로그인 정보 또는 캐시를 완전히 정리하지 못했습니다. '
            '안전을 위해 로그인 화면으로 이동합니다. 다시 로그인하기 전에 앱 또는 브라우저 데이터를 삭제해 주세요.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('확인'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_isDeletingAccount,
      child: ValueListenableBuilder<bool>(
        valueListenable: AppThemeController.isLightMode,
        builder: (context, isLightMode, _) {
          return Scaffold(
            backgroundColor: AppThemeController.backgroundColor,
            body: Stack(
              children: [
                AbsorbPointer(
                  absorbing: _isDeletingAccount,
                  child: SafeArea(
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
                                      builder: (_) =>
                                          const OfflineContentScreen(),
                                    ),
                                  );
                                },
                              ),
                              const SizedBox(height: 12),
                              _SettingsActionTile(
                                icon: Icons.delete_forever_rounded,
                                title: '회원탈퇴',
                                subtitle: '계정과 관련 데이터를 영구 삭제합니다',
                                iconColor: const Color(0xFFFF6B6B),
                                titleColor: const Color(0xFFFF6B6B),
                                trailing: const SizedBox.shrink(),
                                onTap: _confirmAndDeleteAccount,
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
                                  widget.onLogout();
                                },
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_isDeletingAccount) ...[
                  const Positioned.fill(
                    child: ColoredBox(color: Color(0x99000000)),
                  ),
                  const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 16),
                        Text('회원탈퇴 처리 중입니다...'),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
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
