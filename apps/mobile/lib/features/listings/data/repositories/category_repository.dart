import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../models/category.dart';

class CategoryRepository {
  final ApiClient _apiClient = ApiClient();

  Future<List<Category>> getCategories() async {
    try {
      final response = await _apiClient.dio.get('/categories');
      if (response.statusCode == 200) {
        final data = response.data;
        if (data is List) {
          return data.map((json) => Category.fromJson(json)).toList();
        } else if (data['data'] is List) {
          return (data['data'] as List).map((json) => Category.fromJson(json)).toList();
        }
      }
      return [];
    } catch (e) {
      throw Exception('Failed to load categories: $e');
    }
  }
}
