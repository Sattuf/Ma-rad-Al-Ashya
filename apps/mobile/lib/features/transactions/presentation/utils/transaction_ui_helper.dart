import 'package:flutter/material.dart';
import 'package:marad_mobile/features/transactions/data/models/transaction_model.dart';

class TransactionUIHelper {
  static String getStatusText(TransactionStatus status) {
    switch (status) {
      case TransactionStatus.pendingSeller:
        return 'بانتظار تأكيد البائع';
      case TransactionStatus.pendingBuyer:
        return 'بانتظار تأكيد المشتري';
      case TransactionStatus.completed:
        return 'مكتملة';
      case TransactionStatus.cancelled:
        return 'ملغاة';
    }
  }

  static Color getStatusColor(TransactionStatus status) {
    switch (status) {
      case TransactionStatus.pendingSeller:
        return Colors.orange;
      case TransactionStatus.pendingBuyer:
        return Colors.blue;
      case TransactionStatus.completed:
        return Colors.green;
      case TransactionStatus.cancelled:
        return Colors.red;
    }
  }
}
