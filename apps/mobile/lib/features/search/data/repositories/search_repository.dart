import '../../../../core/network/api_client.dart';
import '../../../listings/data/models/listing.dart';

class SearchResponse {
  final List<Listing> listings;
  final String variant;

  SearchResponse({required this.listings, required this.variant});
}

class SearchRepository {
  final ApiClient _apiClient = ApiClient();

  Future<SearchResponse> searchListings({
    required String query,
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? sort,
    double? minPrice,
    double? maxPrice,
    String? condition,
    String? abVariant,
    String? sessionId,
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
        if (abVariant != null && abVariant.isNotEmpty) 'ab_variant': abVariant,
        if (sessionId != null && sessionId.isNotEmpty) 'session_id': sessionId,
      };

      final response = await _apiClient.dio.get('/listings', queryParameters: queryParams);
      if (response.statusCode == 200) {
        final data = response.data;
        List<Listing> listings = [];
        String variant = '';
        if (data is List) {
          listings = data.map((json) => Listing.fromJson(json)).toList();
        } else if (data is Map) {
          if (data['data'] is List) {
            listings = (data['data'] as List).map((json) => Listing.fromJson(json)).toList();
          }
          if (data['variant'] != null) {
            variant = data['variant'].toString();
          }
        }
        return SearchResponse(listings: listings, variant: variant);
      }
      return SearchResponse(listings: [], variant: '');
    } catch (e) {
      throw Exception('Failed to search listings: $e');
    }
  }

  void trackClick({
    required String query,
    required String listingId,
    required int position,
    required String variant,
    required String sessionId,
  }) {
    try {
      _apiClient.dio.post(
        '/search/track-click',
        data: {
          'query': query,
          'listing_id': listingId,
          'position': position,
          'variant': variant,
          'session_id': sessionId,
        },
      );
    } catch (_) {
      // Fire-and-forget, catch errors silently
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
