import 'package:marad_mobile/core/network/api_client.dart';
import '../models/listing.dart';

class RecommendationsRepository {
  final ApiClient _apiClient = ApiClient();

  Future<List<Listing>> getRecommendations({int limit = 4}) async {
    try {
      final response = await _apiClient.dio.get(
        '/recommendations',
        queryParameters: {'limit': limit},
      );
      if (response.statusCode == 200) {
        final data = response.data;
        if (data is List) {
          return data.map((json) => Listing.fromJson(json)).toList();
        } else if (data['data'] is List) {
          return (data['data'] as List).map((json) => Listing.fromJson(json)).toList();
        }
      }
      return [];
    } catch (e) {
      throw Exception('Failed to get recommendations: $e');
    }
  }

  Future<List<Listing>> getColdStartRecommendations({int limit = 4}) async {
    try {
      final response = await _apiClient.dio.get(
        '/recommendations/cold-start',
        queryParameters: {'limit': limit},
      );
      if (response.statusCode == 200) {
        final data = response.data;
        if (data is List) {
          return data.map((json) => Listing.fromJson(json)).toList();
        } else if (data['data'] is List) {
          return (data['data'] as List).map((json) => Listing.fromJson(json)).toList();
        }
      }
      return [];
    } catch (e) {
      // Fallback: fetch active listings
      try {
        final listingsResponse = await _apiClient.dio.get(
          '/listings',
          queryParameters: {'limit': limit},
        );
        if (listingsResponse.statusCode == 200) {
          final data = listingsResponse.data;
          if (data is List) {
            return data.map((json) => Listing.fromJson(json)).toList();
          } else if (data['data'] is List) {
            return (data['data'] as List).map((json) => Listing.fromJson(json)).toList();
          }
        }
      } catch (_) {}
      return [];
    }
  }
}
