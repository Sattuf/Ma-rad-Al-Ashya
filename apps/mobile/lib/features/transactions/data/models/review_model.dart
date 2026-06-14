class Review {
  final String id;
  final String transactionId;
  final String reviewerId;
  final String revieweeId;
  final String listingId;
  final double rating;
  final String? comment;
  final DateTime createdAt;
  final String? reviewerName;
  final String? reviewerAvatar;

  Review({
    required this.id,
    required this.transactionId,
    required this.reviewerId,
    required this.revieweeId,
    required this.listingId,
    required this.rating,
    this.comment,
    required this.createdAt,
    this.reviewerName,
    this.reviewerAvatar,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id'] ?? json['_id'] ?? '',
      transactionId: json['transactionId'] ?? '',
      reviewerId: json['reviewerId'] ?? '',
      revieweeId: json['revieweeId'] ?? '',
      listingId: json['listingId'] ?? '',
      rating: (json['rating'] ?? 0).toDouble(),
      comment: json['comment'],
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
      reviewerName: json['reviewerName'],
      reviewerAvatar: json['reviewerAvatar'],
    );
  }
}
