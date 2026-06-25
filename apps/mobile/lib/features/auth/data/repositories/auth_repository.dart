import 'package:dio/dio.dart';
import 'package:marad_mobile/core/network/api_client.dart';
import 'package:marad_mobile/core/storage/secure_storage.dart';

class AuthRepository {
  final Dio _dio = ApiClient().dio;
  final SecureStorage _storage = SecureStorage();

  Future<Map<String, dynamic>> register({
    String? email,
    String? phone,
    required String fullName,
    required String password,
    String? fingerprintHash,
  }) async {
    final response = await _dio.post('/auth/register', data: {
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      'fullName': fullName,
      'password': password,
      if (fingerprintHash != null) 'fingerprint_hash': fingerprintHash,
    });
    final data = response.data;
    await _storage.saveTokens(
      data['tokens']['access_token'],
      data['tokens']['refresh_token'],
    );
    return data;
  }

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final response = await _dio.post('/auth/login', data: {
      'identifier': identifier,
      'password': password,
    });
    final data = response.data;
    await _storage.saveTokens(
      data['tokens']['access_token'],
      data['tokens']['refresh_token'],
    );
    return data;
  }

  Future<Map<String, dynamic>> sendOtp({required String phone}) async {
    final response = await _dio.post('/auth/send-otp', data: {
      'phone': phone,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String phone,
    required String code,
  }) async {
    final response = await _dio.post('/auth/verify-otp', data: {
      'phone': phone,
      'code': code,
    });
    final data = response.data;
    await _storage.saveTokens(
      data['tokens']['access_token'],
      data['tokens']['refresh_token'],
    );
    return data;
  }

  Future<Map<String, dynamic>> googleSignIn({
    String? idToken,
    String? accessToken,
  }) async {
    final response = await _dio.post('/auth/google/token', data: {
      if (idToken != null) 'id_token': idToken,
      if (accessToken != null) 'access_token': accessToken,
    });
    final data = response.data;
    await _storage.saveTokens(
      data['tokens']['access_token'],
      data['tokens']['refresh_token'],
    );
    return data;
  }

  Future<Map<String, dynamic>> facebookSignIn({
    required String accessToken,
  }) async {
    final response = await _dio.post('/auth/facebook/token', data: {
      'access_token': accessToken,
    });
    final data = response.data;
    await _storage.saveTokens(
      data['tokens']['access_token'],
      data['tokens']['refresh_token'],
    );
    return data;
  }

  Future<void> logout() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken != null) {
        await _dio.post('/auth/logout', data: {
          'refresh_token': refreshToken,
        });
      }
    } catch (_) {
      // Ignore errors on logout
    } finally {
      await _storage.clearTokens();
    }
  }
}
