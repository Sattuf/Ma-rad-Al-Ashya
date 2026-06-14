import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/search_repository.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepository();
});

class SearchFilters {
  final String query;
  final String? categoryId;
  final String? sort;
  final double? minPrice;
  final double? maxPrice;
  final String? condition;

  SearchFilters({
    this.query = '',
    this.categoryId,
    this.sort,
    this.minPrice,
    this.maxPrice,
    this.condition,
  });

  SearchFilters copyWith({
    String? query,
    String? categoryId,
    String? sort,
    double? minPrice,
    double? maxPrice,
    String? condition,
    bool clearCategory = false,
    bool clearSort = false,
    bool clearCondition = false,
  }) {
    return SearchFilters(
      query: query ?? this.query,
      categoryId: clearCategory ? null : (categoryId ?? this.categoryId),
      sort: clearSort ? null : (sort ?? this.sort),
      minPrice: minPrice ?? this.minPrice,
      maxPrice: maxPrice ?? this.maxPrice,
      condition: clearCondition ? null : (condition ?? this.condition),
    );
  }
}

class SearchFiltersNotifier extends StateNotifier<SearchFilters> {
  SearchFiltersNotifier() : super(SearchFilters());

  void setQuery(String query) {
    state = state.copyWith(query: query);
  }

  void setCategory(String? categoryId) {
    state = state.copyWith(categoryId: categoryId, clearCategory: categoryId == null);
  }

  void setSort(String? sort) {
    state = state.copyWith(sort: sort, clearSort: sort == null);
  }

  void setCondition(String? condition) {
    state = state.copyWith(condition: condition, clearCondition: condition == null);
  }

  void setPriceRange(double? min, double? max) {
    state = state.copyWith(minPrice: min, maxPrice: max);
  }

  void clearFilters() {
    state = SearchFilters(query: state.query);
  }
}

final searchFiltersProvider = StateNotifierProvider<SearchFiltersNotifier, SearchFilters>((ref) {
  return SearchFiltersNotifier();
});

final searchSuggestionsProvider = FutureProvider.family<List<String>, String>((ref, query) async {
  if (query.isEmpty) return [];
  final repository = ref.read(searchRepositoryProvider);
  return repository.getSearchSuggestions(query);
});
