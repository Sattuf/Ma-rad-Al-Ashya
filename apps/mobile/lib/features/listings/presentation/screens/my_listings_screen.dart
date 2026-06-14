import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import '../data/models/listing.dart';
import '../providers/listing_provider.dart';
import '../widgets/listing_card.dart';
import '../widgets/shimmer_listing_card.dart';

class MyListingsScreen extends ConsumerStatefulWidget {
  const MyListingsScreen({super.key});

  @override
  ConsumerState<MyListingsScreen> createState() => _MyListingsScreenState();
}

class _MyListingsScreenState extends ConsumerState<MyListingsScreen> {
  static const _pageSize = 20;
  final PagingController<int, Listing> _pagingController = PagingController(firstPageKey: 1);

  @override
  void initState() {
    super.initState();
    _pagingController.addPageRequestListener((pageKey) {
      _fetchPage(pageKey);
    });
  }

  Future<void> _fetchPage(int pageKey) async {
    try {
      final repository = ref.read(listingRepositoryProvider);
      final newItems = await repository.getMyListings(
        page: pageKey,
        limit: _pageSize,
      );
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('إعلاناتي'),
      ),
      body: RefreshIndicator(
        onRefresh: () => Future.sync(() => _pagingController.refresh()),
        child: PagedListView<int, Listing>(
          pagingController: _pagingController,
          builderDelegate: PagedChildBuilderDelegate<Listing>(
            itemBuilder: (context, item, index) => ListingCard(
              listing: item,
              onTap: () => context.push('/listings/${item.id}'),
            ),
            firstPageProgressIndicatorBuilder: (_) => ListView.builder(
              itemCount: 5,
              itemBuilder: (context, index) => const ShimmerListingCard(),
            ),
            newPageProgressIndicatorBuilder: (_) => const ShimmerListingCard(),
            noItemsFoundIndicatorBuilder: (_) => const Center(
              child: Text('لم تقم بإضافة أي إعلانات بعد'),
            ),
          ),
        ),
      ),
    );
  }
}
