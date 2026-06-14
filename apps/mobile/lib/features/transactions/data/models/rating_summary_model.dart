class RatingSummary {
  final String userId;
  final int totalReviews;
  final double averageRating;
  final int rating1Count;
  final int rating2Count;
  final int rating3Count;
  final int rating4Count;
  final int rating5Count;

  RatingSummary({
    required this.userId,
    required this.totalReviews,
    required this.averageRating,
    required this.rating1Count,
    required this.rating2Count,
    required this.rating3Count,
    required this.rating4Count,
    required this.rating5Count,
  });

  factory RatingSummary.fromJson(Map<String, dynamic> json) {
    return RatingSummary(
      userId: json['userId'] ?? '',
      totalReviews: json['totalReviews'] ?? 0,
      averageRating: (json['averageRating'] ?? 0).toDouble(),
      rating1Count: json['rating1Count'] ?? 0,
      rating2Count: json['rating2Count'] ?? 0,
      rating3Count: json['rating3Count'] ?? 0,
      rating4Count: json['rating4Count'] ?? 0,
      rating5Count: json['rating5Count'] ?? 0,
    );
  }
}
