import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:marad_mobile/core/theme/app_theme.dart';

// The full app (MyApp) needs Firebase, secure storage and the network, so this smoke test
// covers what every screen shares instead: both themes build and carry the token colors.
void main() {
  for (final entry in {
    'light': AppTheme.lightTheme,
    'dark': AppTheme.darkTheme,
  }.entries) {
    testWidgets('${entry.key} theme renders an RTL screen with token colors', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: entry.value,
          home: const Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(body: Center(child: Text('معرض الأشياء'))),
          ),
        ),
      );

      expect(find.text('معرض الأشياء'), findsOneWidget);
      expect(entry.value.extension<AppColorsTheme>(), isNotNull);
    });
  }
}
