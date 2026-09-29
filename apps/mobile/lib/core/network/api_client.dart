import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:marad_mobile/core/storage/secure_storage.dart';

class ApiClient {
  // Where the development server runs. On a real phone, pass the computer's Wi-Fi IP:
  //   flutter run --dart-define=SERVER_HOST=192.168.1.20
  // Default: the Android emulator's alias for the host machine (the browser for web).
  static const String _serverHost = String.fromEnvironment(
    'SERVER_HOST',
    defaultValue: kIsWeb ? '127.0.0.1' : '10.0.2.2',
  );

  // Release builds pass the real addresses: --dart-define=API_URL=https://api.example.com/api/v1
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://$_serverHost:3000/api/v1',
  );

  // messaging-service's socket.io endpoint; the gateway does not proxy websockets.
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'http://$_serverHost:3004',
  );

  late final Dio dio;
  final SecureStorage _storage = SecureStorage();

  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  ApiClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshed = await _tryRefreshToken();
          if (refreshed) {
            // Retry the original request with the new token
            final token = await _storage.getAccessToken();
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            try {
              final response = await dio.fetch(error.requestOptions);
              handler.resolve(response);
              return;
            } catch (e) {
              handler.reject(error);
              return;
            }
          } else {
            // Refresh failed — clear tokens (will redirect to login)
            await _storage.clearTokens();
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<bool> _tryRefreshToken() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken == null) return false;

      // Use a separate Dio instance to avoid interceptor loops
      final refreshDio = Dio(BaseOptions(
        baseUrl: baseUrl,
        headers: {
          'Content-Type': 'application/json',
        },
      ));

      final response = await refreshDio.post(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
      );

      if (response.statusCode == 200) {
        final tokens = response.data['tokens'];
        await _storage.saveTokens(
          tokens['access_token'],
          tokens['refresh_token'],
        );
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
}
