import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:marad_mobile/features/favorites/data/repositories/favorites_repository.dart';

final favoritesRepositoryProvider = Provider((ref) => FavoritesRepository());

class FavoritesNotifier extends StateNotifier<Map<String, bool>> {
  final FavoritesRepository _repository;

  FavoritesNotifier(this._repository) : super({});

  Future<void> checkFavorite(String listingId) async {
    if (state.containsKey(listingId)) return;
    try {
      final isFavorite = await _repository.checkFavorite(listingId);
      state = {...state, listingId: isFavorite};
    } catch (e) {
      // Ignore
    }
  }

  Future<bool> toggleFavorite(String listingId) async {
    final currentlyFavorite = state[listingId] ?? false;
    final newFavoriteState = !currentlyFavorite;
    
    // Optimistic Update
    state = {...state, listingId: newFavoriteState};

    try {
      if (newFavoriteState) {
        await _repository.addFavorite(listingId);
      } else {
        await _repository.removeFavorite(listingId);
      }
      return true;
    } catch (e) {
      // Revert on error
      state = {...state, listingId: currentlyFavorite};
      return false; // Indicating failure
    }
  }

  void setFavorite(String listingId, bool isFavorite) {
    state = {...state, listingId: isFavorite};
  }
}

final favoritesProvider = StateNotifierProvider<FavoritesNotifier, Map<String, bool>>((ref) {
  final repository = ref.watch(favoritesRepositoryProvider);
  return FavoritesNotifier(repository);
});
