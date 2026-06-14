import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/category_repository.dart';
import '../../data/models/category.dart';

final categoryRepositoryProvider = Provider((ref) => CategoryRepository());

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final repository = ref.read(categoryRepositoryProvider);
  return repository.getCategories();
});
