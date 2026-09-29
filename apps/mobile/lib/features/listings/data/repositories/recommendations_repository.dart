import 'package:marad_mobile/core/network/api_client.dart';
import '../models/listing.dart';

/// personalization-service answers `{listings: [...], based_on}` with search-index documents
/// (no images, category as a plain name). Only their ids and order are used: the listings
/// themselves come from listings-service in one batch (`GET /listings?ids=`), the same way
/// the web hydrates search results, so cards have their photos and current data.
class RecommendationsRepository {
  final ApiClient _apiClient = ApiClient();

  Future<List<Listing>> getRecommendations({int limit = 4}) =>
      _recommended('/recommendations', limit);

  Future<List<Listing>> getColdStartRecommendations({int limit = 4}) async {
    try {
      return await _recommended('/recommendations/cold-start', limit);
    } catch (_) {
      // Recommendations unavailable: show the newest listings instead.
      final response = await _apiClient.dio.get('/listings', queryParameters: {'limit': limit});
      return _listingsFrom(response.data);
    }
  }

  Future<List<Listing>> _recommended(String path, int limit) async {
    final response = await _apiClient.dio.get(path, queryParameters: {'limit': limit});
    final raw = response.data is Map ? response.data['listings'] : null;
    final ids = (raw is List ? raw : const [])
        .map((e) => e is Map ? e['id']?.toString() : null)
        .whereType<String>()
        .toList();
    if (ids.isEmpty) return [];

    final hydrated = await _apiClient.dio.get(
      '/listings',
      queryParameters: {'ids': ids.join(','), 'limit': ids.length},
    );
    final byId = {for (final l in _listingsFrom(hydrated.data)) l.id: l};
    // Keep the recommended order; drop listings that are no longer published.
    return ids.map((id) => byId[id]).whereType<Listing>().toList();
  }

  List<Listing> _listingsFrom(dynamic data) {
    final items = data is List ? data : (data is Map && data['data'] is List ? data['data'] as List : const []);
    return items.whereType<Map<String, dynamic>>().map(Listing.fromJson).toList();
  }
}
