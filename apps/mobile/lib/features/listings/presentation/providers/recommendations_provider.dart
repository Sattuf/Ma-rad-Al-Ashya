import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/recommendations_repository.dart';
import '../../data/models/listing.dart';
import '../../../../auth/presentation/providers/auth_provider.dart';

final recommendationsRepositoryProvider = Provider<RecommendationsRepository>((ref) {
  return RecommendationsRepository();
});

final suggestedListingsProvider = FutureProvider<List<Listing>>((ref) async {
  final repository = ref.watch(recommendationsRepositoryProvider);
  final authState = ref.watch(authProvider);

  final isLoggedIn = authState.user != null;

  if (isLoggedIn) {
    try {
      final list = await repository.getRecommendations(limit: 4);
      if (list.isNotEmpty) {
        return list;
      }
    } catch (_) {
      // Fallback on error
    }
  }

  return repository.getColdStartRecommendations(limit: 4);
});
