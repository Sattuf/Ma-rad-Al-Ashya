import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/promotions_repository.dart';

final promotionsRepositoryProvider = Provider<PromotionsRepository>((ref) {
  return PromotionsRepository();
});

final promotionsPlansProvider = FutureProvider<List<PromotionPlan>>((ref) async {
  final repository = ref.watch(promotionsRepositoryProvider);
  return repository.getPlans();
});

final myPromotionsProvider = FutureProvider<List<Promotion>>((ref) async {
  final repository = ref.watch(promotionsRepositoryProvider);
  return repository.getMyPromotions();
});
