import 'package:dio/dio.dart';
import 'package:marad_mobile/core/network/api_client.dart';
import 'package:marad_mobile/features/transactions/data/models/transaction_model.dart';
import 'package:marad_mobile/features/transactions/data/models/review_model.dart';
import 'package:marad_mobile/features/transactions/data/models/rating_summary_model.dart';

class TransactionsRepository {
  final ApiClient _apiClient = ApiClient();

  Future<Transaction> createTransaction(String listingId, String sellerId) async {
    final response = await _apiClient.dio.post(
      '/transactions',
      data: {
        'listingId': listingId,
        'sellerId': sellerId,
      },
    );
    return Transaction.fromJson(response.data['data'] ?? response.data);
  }

  Future<List<Transaction>> getTransactions({
    required String role,
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = {
      'role': role,
      'page': page,
      'limit': limit,
    };
    if (status != null && status.isNotEmpty) {
      queryParams['status'] = status;
    }
    final response = await _apiClient.dio.get(
      '/transactions',
      queryParameters: queryParams,
    );
    
    final List data = response.data['data'] ?? response.data;
    return data.map((json) => Transaction.fromJson(json)).toList();
  }

  Future<Transaction> getTransaction(String id) async {
    final response = await _apiClient.dio.get('/transactions/$id');
    return Transaction.fromJson(response.data['data'] ?? response.data);
  }

  Future<Transaction> confirmTransaction(String id) async {
    final response = await _apiClient.dio.post('/transactions/$id/confirm');
    return Transaction.fromJson(response.data['data'] ?? response.data);
  }

  Future<Transaction> cancelTransaction(String id, {String? reason}) async {
    final response = await _apiClient.dio.post(
      '/transactions/$id/cancel',
      data: reason != null ? {'reason': reason} : {},
    );
    return Transaction.fromJson(response.data['data'] ?? response.data);
  }

  Future<Review> createReview(String transactionId, double rating, {String? comment}) async {
    final response = await _apiClient.dio.post(
      '/transactions/$transactionId/reviews',
      data: {
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
    return Review.fromJson(response.data['data'] ?? response.data);
  }

  Future<List<Review>> getUserReviews(String userId, {int page = 1, int limit = 20}) async {
    final response = await _apiClient.dio.get(
      '/users/$userId/reviews',
      queryParameters: {
        'page': page,
        'limit': limit,
      },
    );
    final List data = response.data['data'] ?? response.data;
    return data.map((json) => Review.fromJson(json)).toList();
  }
  
  Future<RatingSummary> getUserRatingSummary(String userId) async {
    final response = await _apiClient.dio.get('/users/$userId/rating-summary');
    return RatingSummary.fromJson(response.data['data'] ?? response.data);
  }
}
