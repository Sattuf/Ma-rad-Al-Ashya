import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:marad_mobile/features/auth/presentation/screens/login_screen.dart';
import 'package:marad_mobile/core/theme/app_theme.dart';

void main() {
  testWidgets('LoginScreen renders form fields and buttons', (WidgetTester tester) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const Scaffold(body: LoginScreen()),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          theme: AppTheme.lightTheme,
          routerConfig: router,
        ),
      ),
    );

    // Wait for animations/rendering
    await tester.pumpAndSettle();

    // Assert TextFields are present
    expect(find.byType(TextField), findsNWidgets(2));
    
    // Assert Login button is present
    expect(find.text('تسجيل الدخول'), findsOneWidget);
    
    // Assert Google and Facebook buttons are present
    expect(find.text('جوجل'), findsOneWidget);
    expect(find.text('فيسبوك'), findsOneWidget);
    
    // Assert register link is present
    expect(find.text('ليس لديك حساب؟ إنشاء حساب جديد'), findsOneWidget);
  });
}
