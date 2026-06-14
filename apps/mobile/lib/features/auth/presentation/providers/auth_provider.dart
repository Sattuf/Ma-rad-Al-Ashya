import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:marad_mobile/features/auth/data/repositories/auth_repository.dart';

// Auth State
enum AuthStatus { idle, loading, success, error }

class AuthState {
  final AuthStatus status;
  final Map<String, dynamic>? user;
  final String? errorMessage;

  const AuthState({
    this.status = AuthStatus.idle,
    this.user,
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    Map<String, dynamic>? user,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      errorMessage: errorMessage,
    );
  }
}

// Auth Notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(const AuthState());

  Future<void> register({
    String? email,
    String? phone,
    required String fullName,
    required String password,
  }) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final data = await _repository.register(
        email: email,
        phone: phone,
        fullName: fullName,
        password: password,
      );
      state = state.copyWith(status: AuthStatus.success, user: data['user']);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: _extractError(e),
      );
    }
  }

  Future<void> login({
    required String identifier,
    required String password,
  }) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final data = await _repository.login(
        identifier: identifier,
        password: password,
      );
      state = state.copyWith(status: AuthStatus.success, user: data['user']);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: _extractError(e),
      );
    }
  }

  Future<void> sendOtp({required String phone}) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      await _repository.sendOtp(phone: phone);
      state = state.copyWith(status: AuthStatus.success);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: _extractError(e),
      );
    }
  }

  Future<void> verifyOtp({
    required String phone,
    required String code,
  }) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final data = await _repository.verifyOtp(phone: phone, code: code);
      state = state.copyWith(status: AuthStatus.success, user: data['user']);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: _extractError(e),
      );
    }
  }

  Future<void> signInWithGoogle() async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final googleUser = await GoogleSignIn(scopes: ['email', 'profile']).signIn();
      if (googleUser == null) {
        state = state.copyWith(status: AuthStatus.idle);
        return;
      }
      final auth = await googleUser.authentication;
      if (auth.idToken == null) {
        state = state.copyWith(
          status: AuthStatus.error,
          errorMessage: 'فشل الحصول على رمز Google',
        );
        return;
      }
      final data = await _repository.googleSignIn(idToken: auth.idToken!);
      state = state.copyWith(status: AuthStatus.success, user: data['user']);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: _extractError(e),
      );
    }
  }

  Future<void> signInWithFacebook() async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final result = await FacebookAuth.instance.login(permissions: ['email', 'public_profile']);
      if (result.status != LoginStatus.success || result.accessToken == null) {
        state = state.copyWith(status: AuthStatus.idle);
        return;
      }
      final data = await _repository.facebookSignIn(
        accessToken: result.accessToken!.tokenString,
      );
      state = state.copyWith(status: AuthStatus.success, user: data['user']);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: _extractError(e),
      );
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState();
  }

  void resetState() {
    state = const AuthState();
  }

  String _extractError(dynamic e) {
    if (e is Exception) {
      final str = e.toString();
      // Try to extract DioException message
      if (str.contains('message')) {
        final match = RegExp(r'"message"\s*:\s*"([^"]+)"').firstMatch(str);
        if (match != null) return match.group(1)!;
      }
    }
    return 'حدث خطأ غير متوقع. الرجاء المحاولة لاحقاً';
  }
}

// Riverpod Providers
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository();
});

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});
