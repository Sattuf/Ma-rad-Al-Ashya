import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:marad_mobile/features/transactions/data/models/transaction_model.dart';
import 'package:marad_mobile/features/transactions/presentation/providers/transactions_provider.dart';

final transactionDetailProvider = FutureProvider.family<Transaction, String>((ref, id) async {
  final repository = ref.watch(transactionsRepositoryProvider);
  return repository.getTransaction(id);
});
