import 'package:flutter/material.dart';
import 'package:google_sign_in_web/web_only.dart';

class GoogleSignInWebButton extends StatelessWidget {
  const GoogleSignInWebButton({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: renderButton(
        configuration: GSIButtonConfiguration(
          theme: GSIButtonTheme.outline,
          shape: GSIButtonShape.rectangular,
          size: GSIButtonSize.large,
          logoAlignment: GSIButtonLogoAlignment.center,
          text: GSIButtonText.signinWith,
        ),
      ),
    );
  }
}
