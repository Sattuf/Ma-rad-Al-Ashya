import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/api_client.dart';

class AnalyticsService {
  final ApiClient _apiClient = ApiClient();

  void trackEvent(
    String eventType, {
    String? listingId,
    String? categoryId,
    String? searchQuery,
  }) {
    // Fire-and-forget (do not await, catch errors silently)
    _apiClient.dio.post(
      '/events',
      data: {
        'eventType': eventType,
        if (listingId != null) 'listingId': listingId,
        if (categoryId != null) 'categoryId': categoryId,
        if (searchQuery != null) 'searchQuery': searchQuery,
      },
    ).catchError((e) {
      // Catch errors silently
      print('Silently caught analytics event tracking error: $e');
      return Response(requestOptions: RequestOptions(path: '/events'));
    });
  }
}

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService();
});
