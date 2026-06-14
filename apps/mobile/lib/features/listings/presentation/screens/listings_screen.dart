import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import '../data/models/listing.dart';
import '../data/models/category.dart';
import '../providers/listing_provider.dart';
import '../providers/category_provider.dart';
import '../widgets/listing_card.dart';
import '../widgets/shimmer_listing_card.dart';

class ListingsScreen extends ConsumerStatefulWidget {
  const ListingsScreen({super.key});

  @override
  ConsumerState<ListingsScreen> createState() => _ListingsScreenState();
}

class _ListingsScreenState extends ConsumerState<ListingsScreen> {
  static const _pageSize = 20;
  final PagingController<int, Listing> _pagingController = PagingController(firstPageKey: 1);
  String? _selectedCategoryId;
  String? _searchQuery;
  final TextEditingController _searchController = TextEditingController();

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
      final newItems = await repository.getListings(
        page: pageKey,
        limit: _pageSize,
        categoryId: _selectedCategoryId,
        search: _searchQuery,
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
    _searchController.dispose();
    super.dispose();
  }

  void _applyFilter() {
    _searchQuery = _searchController.text.isNotEmpty ? _searchController.text : null;
    _pagingController.refresh();
  }

  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('الإعلانات'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.push('/listings/create'),
          ),
          IconButton(
            icon: const Icon(Icons.list_alt),
            onPressed: () => context.push('/listings/my'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'ابحث عن...',
                      prefixIcon: const Icon(Icons.search),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(vertical: 0),
                    ),
                    onSubmitted: (_) => _applyFilter(),
                  ),
                ),
                const SizedBox(width: 8),
                categoriesAsync.when(
                  data: (categories) => DropdownButtonHideUnderline(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: DropdownButton<String?>(
                        value: _selectedCategoryId,
                        hint: const Text('التصنيف'),
                        items: [
                          const DropdownMenuItem(value: null, child: Text('الكل')),
                          ...categories.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))),
                        ],
                        onChanged: (val) {
                          setState(() {
                            _selectedCategoryId = val;
                          });
                          _pagingController.refresh();
                        },
                      ),
                    ),
                  ),
                  loading: () => const CircularProgressIndicator(),
                  error: (_, __) => const Icon(Icons.error),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
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
                    child: Text('لا توجد إعلانات'),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
