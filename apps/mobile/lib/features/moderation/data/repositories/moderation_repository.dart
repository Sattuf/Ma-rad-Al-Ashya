import 'package:marad_mobile/core/network/api_client.dart';
import 'package:dio/dio.dart';

class ModerationRepository {
  final ApiClient _apiClient = ApiClient();

  Future<void> createReport({
    required String targetType,
    required String targetId,
    required String reason,
    String? description,
  }) async {
    try {
      await _apiClient.dio.post('/reports', data: {
        'target_type': targetType,
        'target_id': targetId,
        'reason': reason,
        if (description != null && description.isNotEmpty) 'description': description,
      });
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        throw const FormatException('already_reported');
      }
      rethrow;
    }
  }
}
