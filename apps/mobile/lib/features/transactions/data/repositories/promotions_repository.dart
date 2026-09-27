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

  factory PromotionPlan.fromJson(Map<String, dynamic> json) {
    return PromotionPlan(
      id: json['id'] as String,
      name: json['name'] as String,
      price: (json['price'] as num).toDouble(),
      durationDays: json['durationDays'] as int? ?? json['duration_days'] as int? ?? 0,
      description: json['description'] as String? ?? '',
      features: (json['features'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
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
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const String _storageKey = 'marad_promoted_listings';

  Future<List<PromotionPlan>> getPlans() async {
    try {
      final response = await _apiClient.dio.get('/promotions/plans');
      final List data = response.data['data'] ?? response.data;
      return data.map((json) => PromotionPlan.fromJson(json)).toList();
    } catch (e) {
      // Fallback plans
      return [
        PromotionPlan(
          id: 'basic',
          name: 'أساسي (Basic)',
          price: 49,
          durationDays: 7,
          description: 'ترقية الإعلان ووضعه في مقدمة القائمة لمدة 7 أيام.',
          features: ['ظهور متقدم في نتائج البحث', 'علامة تمييز بسيطة', 'دعم فني عادي'],
        ),
        PromotionPlan(
          id: 'featured',
          name: 'مميز (Featured)',
          price: 99,
          durationDays: 14,
          description: 'وضع الإعلان في قائمة العقارات المميزة مع فرصة تصفح أعلى بـ 3 أضعاف.',
          features: ['ظهور في قسم العقارات المميزة', 'شارة "مروّج 🚀" بارزة', 'إحصائيات متقدمة للمشاهدات', 'دعم فني سريع'],
        ),
        PromotionPlan(
          id: 'premium',
          name: 'ذهبي (Premium)',
          price: 199,
          durationDays: 30,
          description: 'أقصى درجات الظهور والتفاعل. يثبت الإعلان في الصفحة الرئيسية مع ترويج مكثف.',
          features: ['تثبيت في أعلى الصفحة الرئيسية', 'شارة "مروّج 🚀" ذهبية براقة', 'تنبيهات للمشتركين المهتمين', 'دعم فني على مدار الساعة', 'تقارير أسبوعية مفصلة'],
        ),
      ];
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
