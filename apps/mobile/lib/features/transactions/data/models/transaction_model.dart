enum TransactionStatus {
  pendingSeller,
  pendingBuyer,
  completed,
  cancelled
}

extension TransactionStatusExtension on TransactionStatus {
  static TransactionStatus fromString(String status) {
    switch (status) {
      case 'pending_seller':
        return TransactionStatus.pendingSeller;
      case 'pending_buyer':
        return TransactionStatus.pendingBuyer;
      case 'completed':
        return TransactionStatus.completed;
      case 'cancelled':
        return TransactionStatus.cancelled;
      default:
        return TransactionStatus.pendingSeller;
    }
  }

  String get value {
    switch (this) {
      case TransactionStatus.pendingSeller:
        return 'pending_seller';
      case TransactionStatus.pendingBuyer:
        return 'pending_buyer';
      case TransactionStatus.completed:
        return 'completed';
      case TransactionStatus.cancelled:
        return 'cancelled';
    }
  }
}

class Transaction {
  final String id;
  final String listingId;
  final String sellerId;
  final String buyerId;
  final TransactionStatus status;
  final DateTime? sellerConfirmedAt;
  final DateTime? buyerConfirmedAt;
  final String? cancelledBy;
  final String? cancelReason;
  final DateTime createdAt;
  final DateTime updatedAt;
  
  // Extra fields that might be returned for display purposes
  final Map<String, dynamic>? listing;
  final Map<String, dynamic>? seller;
  final Map<String, dynamic>? buyer;
  final bool isReviewed;

  Transaction({
    required this.id,
    required this.listingId,
    required this.sellerId,
    required this.buyerId,
    required this.status,
    this.sellerConfirmedAt,
    this.buyerConfirmedAt,
    this.cancelledBy,
    this.cancelReason,
    required this.createdAt,
    required this.updatedAt,
    this.listing,
    this.seller,
    this.buyer,
    this.isReviewed = false,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] ?? json['_id'] ?? '',
      listingId: json['listingId'] ?? '',
      sellerId: json['sellerId'] ?? '',
      buyerId: json['buyerId'] ?? '',
      status: TransactionStatusExtension.fromString(json['status'] ?? ''),
      sellerConfirmedAt: json['sellerConfirmedAt'] != null ? DateTime.parse(json['sellerConfirmedAt']) : null,
      buyerConfirmedAt: json['buyerConfirmedAt'] != null ? DateTime.parse(json['buyerConfirmedAt']) : null,
      cancelledBy: json['cancelledBy'],
      cancelReason: json['cancelReason'],
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : DateTime.now(),
      listing: json['listing'] as Map<String, dynamic>?,
      seller: json['seller'] as Map<String, dynamic>?,
      buyer: json['buyer'] as Map<String, dynamic>?,
      isReviewed: json['isReviewed'] ?? false,
    );
  }
}
