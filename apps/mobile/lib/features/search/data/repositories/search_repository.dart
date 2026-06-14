import '../../../../core/network/api_client.dart';
import '../../../listings/data/models/listing.dart';

class SearchRepository {
  final ApiClient _apiClient = ApiClient();

  Future<List<Listing>> searchListings({
    required String query,
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? sort,
    double? minPrice,
    double? maxPrice,
    String? condition,
  }) async {
    try {
      final queryParams = {
        'search': query,
        'page': page,
        'limit': limit,
        if (categoryId != null && categoryId.isNotEmpty) 'category_id': categoryId,
        if (sort != null && sort.isNotEmpty) 'sort': sort,
        if (minPrice != null) 'min_price': minPrice,
        if (maxPrice != null) 'max_price': maxPrice,
        if (condition != null && condition.isNotEmpty) 'condition': condition,
      };

      final response = await _apiClient.dio.get('/listings', queryParameters: queryParams);
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
      throw Exception('Failed to search listings: $e');
    }
  }

  Future<List<String>> getSearchSuggestions(String query) async {
    if (query.isEmpty) return [];
    try {
      final response = await _apiClient.dio.get('/search/suggestions', queryParameters: {
        'q': query,
      });
      if (response.statusCode == 200) {
        final data = response.data;
        if (data is List) {
          return data.map((e) => e.toString()).toList();
        } else if (data['data'] is List) {
          return (data['data'] as List).map((e) => e.toString()).toList();
        }
      }
      return [];
    } catch (e) {
      // In case the suggestions endpoint doesn't exist yet, return an empty list 
      // instead of failing completely.
      return [];
    }
  }
}
