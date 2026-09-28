import 'package:flutter/material.dart';

import 'app_tokens.dart';

/// Exposes the semantic token colors to widgets: `context.colors.textMuted`.
class AppColorsTheme extends ThemeExtension<AppColorsTheme> {
  final AppColors colors;

  const AppColorsTheme(this.colors);

  @override
  AppColorsTheme copyWith({AppColors? colors}) => AppColorsTheme(colors ?? this.colors);

  @override
  AppColorsTheme lerp(ThemeExtension<AppColorsTheme>? other, double t) =>
      (other is AppColorsTheme && t >= 0.5) ? other : this;
}

extension AppThemeContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColorsTheme>()?.colors ?? AppColors.light;
}

/// Material theme generated from the shared design tokens (packages/design-tokens).
/// Light and dark share the same structure; only the semantic colors differ.
class AppTheme {
  // Kept (as compile-time constants) for existing call sites; new code should use
  // `context.colors`, which also follows dark mode.
  static const Color primaryColor = AppLightColors.primary;
  static const Color primaryDark = AppLightColors.primaryHover;
  static const Color primaryLight = AppPalette.brand300;
  static const Color accentColor = AppLightColors.accent;
  static const Color scaffoldBg = AppLightColors.background;
  static const Color cardBg = AppLightColors.surface;
  static const Color textPrimary = AppLightColors.text;
  static const Color textSecondary = AppLightColors.textMuted;
  static const Color textHint = AppLightColors.textSubtle;
  static const Color error = AppLightColors.danger;
  static const Color success = AppLightColors.success;

  static ThemeData get lightTheme => _build(AppColors.light, Brightness.light);
  static ThemeData get darkTheme => _build(AppColors.dark, Brightness.dark);

  static ThemeData _build(AppColors c, Brightness brightness) {
    final scheme = ColorScheme(
      brightness: brightness,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primarySoft,
      onPrimaryContainer: c.onPrimarySoft,
      secondary: c.accent,
      onSecondary: c.onAccent,
      error: c.danger,
      onError: brightness == Brightness.light ? Colors.white : AppColors.light.text,
      errorContainer: c.dangerSoft,
      onErrorContainer: c.danger,
      surface: c.surface,
      onSurface: c.text,
      onSurfaceVariant: c.textMuted,
      surfaceContainerHighest: c.surfaceMuted,
      outline: c.borderStrong,
      outlineVariant: c.border,
    );

    OutlineInputBorder border(Color color, [double width = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.control),
          borderSide: BorderSide(color: color, width: width),
        );

    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.control));
    const buttonText = TextStyle(fontSize: AppFontSize.base, fontWeight: FontWeight.w600);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      fontFamily: kFontFamily,
      colorScheme: scheme,
      scaffoldBackgroundColor: c.background,
      extensions: [AppColorsTheme(c)],
      materialTapTargetSize: MaterialTapTargetSize.padded,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(color: c.text, fontSize: AppFontSize.lg, fontWeight: FontWeight.w700),
        iconTheme: IconThemeData(color: c.text),
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: BorderSide(color: c.border),
        ),
      ),
      dividerTheme: DividerThemeData(color: c.border, space: 1),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: c.onPrimary,
          minimumSize: const Size(double.infinity, 52),
          shape: shape,
          textStyle: buttonText,
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.text,
          minimumSize: const Size(double.infinity, 52),
          shape: shape,
          side: BorderSide(color: c.border),
          textStyle: buttonText.copyWith(fontWeight: FontWeight.w500),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.primary,
          minimumSize: const Size(kMinTouchTarget, kMinTouchTarget),
          textStyle: const TextStyle(fontSize: AppFontSize.sm, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: AppSpace.s4),
        border: border(c.border),
        enabledBorder: border(c.border),
        focusedBorder: border(c.focusRing, 2),
        errorBorder: border(c.danger),
        focusedErrorBorder: border(c.danger, 2),
        hintStyle: TextStyle(color: c.textSubtle, fontSize: AppFontSize.sm),
        labelStyle: TextStyle(color: c.textMuted, fontSize: AppFontSize.sm),
        errorStyle: TextStyle(color: c.danger, fontSize: AppFontSize.xs),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: c.text,
        contentTextStyle: TextStyle(color: c.surface),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.control)),
      ),
    );
  }
}
