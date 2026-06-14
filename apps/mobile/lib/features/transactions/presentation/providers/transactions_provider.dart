import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:marad_mobile/features/transactions/data/models/transaction_model.dart';
import 'package:marad_mobile/features/transactions/data/models/review_model.dart';
import 'package:marad_mobile/features/transactions/data/models/rating_summary_model.dart';
import 'package:marad_mobile/features/transactions/data/repositories/transactions_repository.dart';

final transactionsRepositoryProvider = Provider((ref) => TransactionsRepository());

class TransactionsState {
  final bool isLoading;
  final List<Transaction> transactions;
  final String? error;

  TransactionsState({
    this.isLoading = false,
    this.transactions = const [],
    this.error,
  });

  TransactionsState copyWith({
    bool? isLoading,
    List<Transaction>? transactions,
    String? error,
  }) {
    return TransactionsState(
      isLoading: isLoading ?? this.isLoading,
      transactions: transactions ?? this.transactions,
      error: error,
    );
  }
}

class TransactionsNotifier extends StateNotifier<TransactionsState> {
  final TransactionsRepository _repository;

  TransactionsNotifier(this._repository) : super(TransactionsState());

  Future<void> fetchTransactions({required String role, String? status}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final transactions = await _repository.getTransactions(role: role, status: status);
      state = state.copyWith(isLoading: false, transactions: transactions);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final transactionsProvider = StateNotifierProvider.family<TransactionsNotifier, TransactionsState, String>((ref, role) {
  final repository = ref.watch(transactionsRepositoryProvider);
  return TransactionsNotifier(repository)..fetchTransactions(role: role);
});

final userRatingSummaryProvider = FutureProvider.family<RatingSummary, String>((ref, userId) {
  return ref.watch(transactionsRepositoryProvider).getUserRatingSummary(userId);
});

final userReviewsProvider = FutureProvider.family<List<Review>, String>((ref, userId) {
  return ref.watch(transactionsRepositoryProvider).getUserReviews(userId, limit: 3);
});
