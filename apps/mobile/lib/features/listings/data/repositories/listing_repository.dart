import 'dart:io';
import 'package:dio/dio.dart';
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
    required List<File> images,
  }) async {
    try {
      final formData = FormData.fromMap({
        'title': title,
        'description': description,
        'price': price,
        'category_id': categoryId,
        'condition': condition,
        'location': location,
      });

      for (int i = 0; i < images.length; i++) {
        formData.files.add(
          MapEntry(
            'images',
            await MultipartFile.fromFile(images[i].path, filename: images[i].path.split('/').last),
          ),
        );
      }

      final response = await _apiClient.dio.post(
        '/listings',
        data: formData,
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        return Listing.fromJson(response.data);
      }
      throw Exception('Failed to create listing');
    } catch (e) {
      throw Exception('Error creating listing: $e');
    }
  }
}
