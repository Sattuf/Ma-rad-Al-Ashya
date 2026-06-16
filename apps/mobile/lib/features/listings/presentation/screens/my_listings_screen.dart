import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import '../../data/models/listing.dart';
import '../providers/listing_provider.dart';
import '../widgets/listing_card.dart';
import '../widgets/shimmer_listing_card.dart';
import '../../../transactions/presentation/providers/promotions_provider.dart';

class MyListingsScreen extends ConsumerStatefulWidget {
  const MyListingsScreen({super.key});

  @override
  ConsumerState<MyListingsScreen> createState() => _MyListingsScreenState();
}

class _MyListingsScreenState extends ConsumerState<MyListingsScreen> {
  static const _pageSize = 20;
  late final PagingController<int, Listing> _pagingController;

  @override
  void initState() {
    super.initState();
    _pagingController = PagingController<int, Listing>(
      fetchPage: (pageKey) async {
        final repository = ref.read(listingRepositoryProvider);
        return await repository.getMyListings(
          page: pageKey,
          limit: _pageSize,
        );
      },
      getNextPageKey: (state) {
        final lastPage = state.pages?.last;
        if (lastPage != null && lastPage.length < _pageSize) return null;
        return (state.keys?.last ?? 0) + 1;
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
    final promotionsAsync = ref.watch(myPromotionsProvider);
    final promotions = promotionsAsync.value ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('إعلاناتي'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myPromotionsProvider);
          _pagingController.refresh();
        },
        child: ValueListenableBuilder<PagingState<int, Listing>>(
          valueListenable: _pagingController,
          builder: (context, state, child) {
            return PagedListView<int, Listing>(
              state: state,
              fetchNextPage: _pagingController.fetchNextPage,
              builderDelegate: PagedChildBuilderDelegate<Listing>(
                itemBuilder: (context, item, index) {
                  final isPromoted = promotions.any((p) => p.listingId == item.id && p.status == 'active');
                  final isActive = item.status == 'active';

                  return ListingCard(
                    listing: item,
                    onTap: () => context.push('/listings/${item.id}'),
                    badge: isPromoted
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade800,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.star, color: Colors.white, size: 14),
                                SizedBox(width: 4),
                                Text(
                                  'مروّج',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : null,
                    bottomAction: !isPromoted && isActive
                        ? SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () => context.push('/listings/${item.id}/promote'),
                              icon: const Icon(Icons.campaign, size: 18),
                              label: const Text('ترويج الإعلان'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.blue.shade700,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 8),
                              ),
                            ),
                          )
                        : null,
                  );
                },
                firstPageProgressIndicatorBuilder: (_) => ListView.builder(
                  itemCount: 5,
                  itemBuilder: (context, index) => const ShimmerListingCard(),
                ),
                newPageProgressIndicatorBuilder: (_) => const ShimmerListingCard(),
                noItemsFoundIndicatorBuilder: (_) => const Center(
                  child: Text('لم تقم بإضافة أي إعلانات بعد'),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
