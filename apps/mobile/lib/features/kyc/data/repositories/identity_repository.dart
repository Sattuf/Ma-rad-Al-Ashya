import '../../../../core/network/api_client.dart';

class IdentityRepository {
  final ApiClient _apiClient = ApiClient();

  Future<Map<String, dynamic>> startKyc() async {
    final response = await _apiClient.dio.post('/identity/kyc/start');
    return response.data;
  }

  Future<Map<String, dynamic>> getKycStatus() async {
    final response = await _apiClient.dio.get('/identity/kyc/status');
    return response.data;
  }
}
