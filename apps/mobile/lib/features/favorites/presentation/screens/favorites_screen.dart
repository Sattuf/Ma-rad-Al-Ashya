import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:go_router/go_router.dart';
import 'package:marad_mobile/features/listings/data/models/listing.dart';
import 'package:marad_mobile/features/listings/presentation/widgets/listing_card.dart';
import 'package:marad_mobile/features/listings/presentation/widgets/shimmer_listing_card.dart';
import '../providers/favorites_provider.dart';

class FavoritesScreen extends ConsumerStatefulWidget {
  const FavoritesScreen({super.key});

  @override
  ConsumerState<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends ConsumerState<FavoritesScreen> {
  static const _pageSize = 20;
  late final PagingController<int, Listing> _pagingController;

  @override
  void initState() {
    super.initState();
    _pagingController = PagingController<int, Listing>(
      firstPageKey: 1,
    );

    _pagingController.addPageRequestListener((pageKey) {
      _fetchPage(pageKey);
    });
  }

  Future<void> _fetchPage(int pageKey) async {
    try {
      final repository = ref.read(favoritesRepositoryProvider);
      final newItems = await repository.getFavorites(page: pageKey, limit: _pageSize);
      
      // Update the local favorites state for these items
      for (var item in newItems) {
        ref.read(favoritesProvider.notifier).setFavorite(item.id, true);
      }

      final isLastPage = newItems.length < _pageSize;
      if (isLastPage) {
        _pagingController.appendLastPage(newItems);
      } else {
        final nextPageKey = pageKey + 1;
        _pagingController.appendPage(newItems, nextPageKey);
      }
    } catch (error) {
      _pagingController.error = error;
    }
  }

  @override
  void dispose() {
    _pagingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // We can listen to favoritesProvider to remove items that are unfavorited
    ref.listen<Map<String, bool>>(favoritesProvider, (previous, next) {
      if (previous != null) {
        final currentItems = _pagingController.itemList;
        if (currentItems != null) {
          final itemsToRemove = <Listing>[];
          for (var item in currentItems) {
            if (next[item.id] == false && previous[item.id] == true) {
              itemsToRemove.add(item);
            }
          }
          if (itemsToRemove.isNotEmpty) {
            final newItems = List<Listing>.from(currentItems)
              ..removeWhere((item) => itemsToRemove.contains(item));
            _pagingController.itemList = newItems;
          }
        }
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('المفضلة'),
      ),
      body: RefreshIndicator(
        onRefresh: () => Future.sync(() => _pagingController.refresh()),
        child: PagedGridView<int, Listing>(
          pagingController: _pagingController,
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 0.7,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
          ),
          builderDelegate: PagedChildBuilderDelegate<Listing>(
            itemBuilder: (context, item, index) => ListingCard(
              listing: item,
              onTap: () => context.push('/listings/${item.id}'),
            ),
            firstPageProgressIndicatorBuilder: (_) => GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.7,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
              ),
              itemCount: 6,
              itemBuilder: (context, index) => const ShimmerListingCard(),
            ),
            newPageProgressIndicatorBuilder: (_) => const Center(child: CircularProgressIndicator()),
            noItemsFoundIndicatorBuilder: (_) => const Center(
              child: Text(
                'لا توجد إعلانات محفوظة',
                style: TextStyle(fontSize: 18, color: Colors.grey),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
