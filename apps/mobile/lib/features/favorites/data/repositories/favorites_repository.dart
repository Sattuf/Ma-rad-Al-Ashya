import 'package:marad_mobile/core/network/api_client.dart';
import 'package:marad_mobile/features/listings/data/models/listing.dart';

class FavoritesRepository {
  final ApiClient _apiClient = ApiClient();

  Future<void> addFavorite(String listingId) async {
    await _apiClient.dio.post('/users/favorites/$listingId');
  }

  Future<void> removeFavorite(String listingId) async {
    await _apiClient.dio.delete('/users/favorites/$listingId');
  }

  Future<bool> checkFavorite(String listingId) async {
    try {
      final response = await _apiClient.dio.get('/users/favorites/$listingId/check');
      return response.data['is_favorite'] == true || response.data == true;
    } catch (e) {
      return false;
    }
  }

  Future<List<Listing>> getFavorites({int page = 1, int limit = 20}) async {
    final response = await _apiClient.dio.get('/users/favorites', queryParameters: {
      'page': page,
      'limit': limit,
    });
    
    final data = response.data['data'] ?? response.data;
    if (data is List) {
      return data.map((json) => Listing.fromJson(json)).toList();
    }
    return [];
  }
}
