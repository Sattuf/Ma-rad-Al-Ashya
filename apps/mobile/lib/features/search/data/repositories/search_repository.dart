import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../../listings/data/models/listing.dart';

class SearchResponse {
  final List<Listing> listings;
  final String variant;

  SearchResponse({required this.listings, required this.variant});
}

class SearchRepository {
  final ApiClient _apiClient = ApiClient();

  /// Text search through search-service — the A/B ranking experiment (same flow as the web,
  /// apps/web/src/lib/api/search.ts). The server assigns a sticky variant (by account, else by
  /// [sessionId]), ranks ids and counts the search; listings are hydrated in one batch keeping
  /// that order. If search is unavailable the query runs on /listings instead, with an empty
  /// variant, so results still show but the search is not part of the experiment.
  ///
  /// [sort], [condition] and [abVariant] are ignored: the ranking is the experiment, and the
  /// client never chooses its variant.
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
    final filters = {
      if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
      if (minPrice != null) 'minPrice': minPrice,
      if (maxPrice != null) 'maxPrice': maxPrice,
    };
    try {
      final ranked = await _apiClient.dio.get('/search', queryParameters: {
        'q': query,
        'page': page,
        'limit': limit,
        if (sessionId != null && sessionId.isNotEmpty) 'session_id': sessionId,
        ...filters,
      });
      final data = Map<String, dynamic>.from(ranked.data as Map);
      final ids = (data['ids'] as List? ?? const []).map((e) => e.toString()).toList();
      final variant = data['variant']?.toString() ?? '';
      if (ids.isEmpty) return SearchResponse(listings: const [], variant: variant);

      final hydrated = await _apiClient.dio.get('/listings', queryParameters: {'ids': ids.join(','), 'limit': ids.length});
      final byId = <String, Listing>{};
      for (final json in (hydrated.data['data'] as List? ?? const [])) {
        final listing = Listing.fromJson(Map<String, dynamic>.from(json as Map));
        if (listing.status == 'active') byId[listing.id] = listing;
      }
      return SearchResponse(listings: [for (final id in ids) if (byId[id] != null) byId[id]!], variant: variant);
    } on DioException catch (e) {
      final status = e.response?.statusCode ?? 0;
      if (e.response != null && status < 500) rethrow; // a real request error, not an outage
      final fallback = await _apiClient.dio.get('/listings', queryParameters: {'search': query, 'page': page, 'limit': limit, ...filters});
      final rows = (fallback.data['data'] as List? ?? const []);
      return SearchResponse(listings: rows.map((json) => Listing.fromJson(Map<String, dynamic>.from(json as Map))).toList(), variant: '');
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
