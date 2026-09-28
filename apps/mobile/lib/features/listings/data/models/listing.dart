import 'category.dart';

class Listing {
  final String id;
  final String title;
  final String description;
  final double price;
  final String currency;
  final String condition;
  final String status;
  final List<String> images;
  final Category? category;
  final String? location;
  final String userId;
  final bool isSellerVerified;
  final DateTime createdAt;

  Listing({
    required this.id,
    required this.title,
    required this.description,
    required this.price,
    this.currency = 'USD',
    required this.condition,
    required this.status,
    required this.images,
    this.category,
    this.location,
    required this.userId,
    this.isSellerVerified = false,
    required this.createdAt,
  });

  /// listings-service sends Postgres DECIMAL prices as strings ("1250.00") and images as
  /// objects ({imageUrl, thumbnailUrl, sortOrder}); older payloads used numbers and URLs.
  factory Listing.fromJson(Map<String, dynamic> json) {
    final rawPrice = json['price'];
    final rawImages = (json['images'] as List<dynamic>?) ?? const [];
    final images = rawImages.map((e) {
      if (e is Map) return {'url': (e['imageUrl'] ?? e['image_url'] ?? '').toString(), 'order': (e['sortOrder'] as num?) ?? 0};
      return {'url': e.toString(), 'order': 0};
    }).toList()
      ..sort((a, b) => (a['order'] as num).compareTo(b['order'] as num));
    final created = json['createdAt'] ?? json['created_at'];
    return Listing(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      price: rawPrice is num ? rawPrice.toDouble() : double.tryParse('${rawPrice ?? ''}') ?? 0.0,
      currency: json['currency'] as String? ?? 'USD',
      condition: json['condition'] as String? ?? 'used',
      status: json['status'] as String? ?? 'active',
      images: images.map((e) => e['url'] as String).where((u) => u.isNotEmpty).toList(),
      category: json['category'] != null ? Category.fromJson(json['category']) : null,
      location: json['location'] as String?,
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
      isSellerVerified: json['user']?['is_verified'] ?? json['is_seller_verified'] ?? false,
      createdAt: created != null ? DateTime.parse(created as String) : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'price': price,
      'currency': currency,
      'condition': condition,
      'status': status,
      'images': images,
      'category': category?.toJson(),
      'location': location,
      'user_id': userId,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
