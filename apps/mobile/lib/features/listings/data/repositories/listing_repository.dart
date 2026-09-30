import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/network/api_client.dart';
import '../models/listing.dart';

class ListingRepository {
  final ApiClient _apiClient = ApiClient();

  Future<List<Listing>> getListings({int page = 1, int limit = 20, String? categoryId, String? search}) async {
    try {
      final queryParams = {
        'page': page,
        'limit': limit,
        if (categoryId != null) 'category_id': categoryId,
        if (search != null) 'search': search,
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
      throw Exception('Failed to load listings: $e');
    }
  }

  Future<List<Listing>> getMyListings({int page = 1, int limit = 20}) async {
    try {
      final response = await _apiClient.dio.get('/listings/my', queryParameters: {
        'page': page,
        'limit': limit,
      });
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
      throw Exception('Failed to load my listings: $e');
    }
  }

  Future<Listing> getListingDetails(String id) async {
    try {
      final response = await _apiClient.dio.get('/listings/$id');
      if (response.statusCode == 200) {
        return Listing.fromJson(response.data);
      }
      throw Exception('Listing not found');
    } catch (e) {
      throw Exception('Failed to load listing details: $e');
    }
  }

  Future<Listing> createListing({
    required String title,
    required String description,
    required double price,
    required String categoryId,
    required String condition,
    required String location,
    required List<XFile> images,
  }) async {
    // listings-service takes the listing as JSON, then each image separately
    // (POST /listings/:id/images, field "file") — the same contract as the web app.
    final created = await _apiClient.dio.post('/listings', data: {
      'title': title,
      'description': description,
      'price': price,
      'categoryId': categoryId,
      'condition': condition,
      if (location.trim().isNotEmpty) 'location': location.trim(),
    });
    final listingId = created.data['id'] as String;

    try {
      for (final image in images) {
        await _apiClient.dio.post(
          '/listings/$listingId/images',
          // Bytes rather than a path: works on Android, iOS and the web alike.
          data: FormData.fromMap({
            'file': MultipartFile.fromBytes(
              await image.readAsBytes(),
              filename: image.name,
              contentType: _imageContentType(image.name),
            ),
          }),
        );
      }
    } catch (_) {
      // All or nothing: the screen tells the user nothing was saved, so remove the
      // listing whose images did not all upload.
      try {
        await _apiClient.dio.delete('/listings/$listingId');
      } catch (_) {}
      rethrow;
    }

    final full = await _apiClient.dio.get('/listings/$listingId');
    return Listing.fromJson(full.data);
  }
}

/// listings-service accepts png and jpeg (image_picker produces jpeg); the part must say which.
DioMediaType _imageContentType(String path) {
  final ext = path.split('.').last.toLowerCase();
  return DioMediaType('image', ext == 'png' ? 'png' : 'jpeg');
}
