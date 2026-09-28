import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:marad_mobile/core/network/api_client.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class PromotionPlan {
  final String id;
  final String name;
  final double price;
  final int durationDays;
  final String description;
  final List<String> features;

  PromotionPlan({
    required this.id,
    required this.name,
    required this.price,
    required this.durationDays,
    required this.description,
    required this.features,
  });

  /// Display copy only (same as the web, apps/web/src/lib/api/promotions.ts). Price,
  /// duration and boost always come from listings-service: GET /promotions/plans →
  /// [{id, price, boost_multiplier, duration_days}].
  static const Map<String, List<String>> _copy = {
    'basic': ['أساسي', 'يرفع ترتيب إعلانك في نتائج البحث.'],
    'featured': ['مميّز', 'دفعة أقوى في نتائج البحث لمدة أطول.'],
    'premium': ['ذهبي', 'أعلى أولوية في نتائج البحث لأطول مدة.'],
  };

  factory PromotionPlan.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as String;
    final rawPrice = json['price'];
    final days = (json['duration_days'] ?? json['durationDays'] ?? 0) as num;
    final boost = (json['boost_multiplier'] ?? json['boostMultiplier'] ?? 1) as num;
    return PromotionPlan(
      id: id,
      name: json['name'] as String? ?? _copy[id]?[0] ?? id,
      price: rawPrice is num ? rawPrice.toDouble() : double.tryParse('$rawPrice') ?? 0,
      durationDays: days.toInt(),
      description: json['description'] as String? ?? _copy[id]?[1] ?? '',
      features: (json['features'] as List<dynamic>?)?.map((e) => e.toString()).toList() ??
          ['ترتيب أعلى ×$boost في نتائج البحث', 'لمدة ${days.toInt()} يوماً', 'دفع آمن عبر Stripe'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'price': price,
      'durationDays': durationDays,
      'description': description,
      'features': features,
    };
  }
}

class Promotion {
  final String id;
  final String listingId;
  final String planId;
  final String status; // 'active' | 'expired'
  final DateTime startDate;
  final DateTime endDate;

  Promotion({
    required this.id,
    required this.listingId,
    required this.planId,
    required this.status,
    required this.startDate,
    required this.endDate,
  });

  factory Promotion.fromJson(Map<String, dynamic> json) {
    return Promotion(
      id: json['id'] as String,
      listingId: json['listingId'] as String? ?? json['listing_id'] as String? ?? '',
      planId: json['planId'] as String? ?? json['plan_id'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      startDate: json['startDate'] != null
          ? DateTime.parse(json['startDate'])
          : json['start_date'] != null
              ? DateTime.parse(json['start_date'])
              : DateTime.now(),
      endDate: json['endDate'] != null
          ? DateTime.parse(json['endDate'])
          : json['end_date'] != null
              ? DateTime.parse(json['end_date'])
              : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'listingId': listingId,
      'planId': planId,
      'status': status,
      'startDate': startDate.toIso8601String(),
      'endDate': endDate.toIso8601String(),
    };
  }
}

class PromotionsRepository {
  final ApiClient _apiClient = ApiClient();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  static const String _storageKey = 'marad_promoted_listings';

  Future<List<PromotionPlan>> getPlans() async {
    try {
      final response = await _apiClient.dio.get('/promotions/plans');
      // The server answers a plain list; some older deployments wrapped it in {data}.
      final raw = response.data;
      final List data = raw is Map ? (raw['data'] as List? ?? const []) : raw as List;
      return data.map((json) => PromotionPlan.fromJson(Map<String, dynamic>.from(json as Map))).toList();
    } catch (e) {
      // No fallback: showing a price the server would not charge is worse than an error.
      // The screen shows the error with a retry.
      debugPrint('getPlans failed: $e');
      rethrow;
    }
  }

  /// Creates the Stripe PaymentIntent on listings-service. No offline fallback: a promotion
  /// exists only after Stripe confirms the payment (server webhook).
  Future<Map<String, dynamic>> createPaymentIntent(String listingId, PromotionPlan plan) async {
    final response = await _apiClient.dio.post(
      '/promotions/create-payment-intent',
      data: {'listingId': listingId, 'plan': plan.id},
    );
    return {'clientSecret': response.data['client_secret'] as String};
  }

  Future<List<Promotion>> getLocalPromotions() async {
    try {
      final stored = await _storage.read(key: _storageKey);
      if (stored == null || stored.isEmpty) return [];
      final List data = json.decode(stored);
      return data.map((json) => Promotion.fromJson(json)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> saveLocalPromotion(String listingId, String planId, int durationDays) async {
    try {
      final promotions = await getLocalPromotions();
      final startDate = DateTime.now();
      final endDate = startDate.add(Duration(days: durationDays));

      final newPromo = Promotion(
        id: 'promo_${DateTime.now().millisecondsSinceEpoch}',
        listingId: listingId,
        planId: planId,
        status: 'active',
        startDate: startDate,
        endDate: endDate,
      );

      // Remove existing active promotion for the same listing if any
      promotions.removeWhere((p) => p.listingId == listingId);
      
      promotions.add(newPromo);
      await _storage.write(key: _storageKey, value: json.encode(promotions.map((p) => p.toJson()).toList()));
    } catch (e) {
      debugPrint('Error saving local promotion: $e');
    }
  }

  Future<List<Promotion>> getMyPromotions() async {
    List<Promotion> apiPromos = [];
    try {
      final response = await _apiClient.dio.get('/promotions/my');
      final List data = response.data['data'] ?? response.data ?? [];
      apiPromos = data.map((json) => Promotion.fromJson(json)).toList();
    } catch (e) {
      // Ignore API error
    }

    final localPromos = await getLocalPromotions();
    final combined = List<Promotion>.from(apiPromos);
    for (var lp in localPromos) {
      if (!combined.any((ap) => ap.listingId == lp.listingId)) {
        combined.add(lp);
      }
    }
    return combined;
  }
}
