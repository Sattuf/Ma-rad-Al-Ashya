import 'category.dart';

class Listing {
  final String id;
  final String title;
  final String description;
  final double price;
  final String condition;
  final String status;
  final List<String> images;
  final Category? category;
  final String? location;
  final String userId;
  final DateTime createdAt;

  Listing({
    required this.id,
    required this.title,
    required this.description,
    required this.price,
    required this.condition,
    required this.status,
    required this.images,
    this.category,
    this.location,
    required this.userId,
    required this.createdAt,
  });

  factory Listing.fromJson(Map<String, dynamic> json) {
    return Listing(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      condition: json['condition'] as String? ?? 'used',
      status: json['status'] as String? ?? 'active',
      images: (json['images'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      category: json['category'] != null ? Category.fromJson(json['category']) : null,
      location: json['location'] as String?,
      userId: json['user_id'] as String? ?? '',
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'price': price,
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
