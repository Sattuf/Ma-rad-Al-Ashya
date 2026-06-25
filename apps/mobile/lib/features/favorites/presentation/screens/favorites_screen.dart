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
      getNextPageKey: (state) {
        if (state.pages?.last != null && (state.pages!.last as List).length < _pageSize) {
          return null; // No more pages
        }
        return (state.keys?.last ?? 0) + 1;
      },
      fetchPage: (pageKey) async {
        final repository = ref.read(favoritesRepositoryProvider);
        final newItems = await repository.getFavorites(page: pageKey, limit: _pageSize);

        // Update the local favorites state for these items
        for (var item in newItems) {
          ref.read(favoritesProvider.notifier).setFavorite(item.id, true);
        }

        return newItems;
      },
    );
  }

  @override
  void dispose() {
    _pagingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('المفضلة'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => _pagingController.refresh(),
        child: PagingListener(
          controller: _pagingController,
          builder: (context, state, fetchNextPage) => PagedGridView<int, Listing>(
            state: state,
            fetchNextPage: fetchNextPage,
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
      ),
    );
  }
}
