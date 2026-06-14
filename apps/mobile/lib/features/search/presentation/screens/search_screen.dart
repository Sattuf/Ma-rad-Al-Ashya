import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:easy_debounce/easy_debounce.dart';

import '../providers/search_provider.dart';
import '../../../listings/data/models/listing.dart';
import '../../../listings/presentation/widgets/listing_card.dart';

class SearchScreen extends ConsumerStatefulWidget {
  final String? initialQuery;

  const SearchScreen({super.key, this.initialQuery});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  
  static const _pageSize = 20;

  late final PagingController<int, Listing> _pagingController;

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null) {
      _searchController.text = widget.initialQuery!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(searchFiltersProvider.notifier).setQuery(widget.initialQuery!);
      });
    }

    _pagingController = PagingController<int, Listing>(
      fetchPage: (pageKey) async {
        final filtersNotifier = ref.read(searchFiltersProvider.notifier);
        final filters = ref.read(searchFiltersProvider);
        final repository = ref.read(searchRepositoryProvider);
        
        final sessionId = filters.sessionId ?? filtersNotifier.getOrCreateSessionId();

        final response = await repository.searchListings(
          query: filters.query,
          page: pageKey,
          limit: _pageSize,
          categoryId: filters.categoryId,
          sort: filters.sort,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          condition: filters.condition,
          sessionId: sessionId,
        );

        filtersNotifier.setVariant(response.variant);
        return response.listings;
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
    _searchController.dispose();
    _searchFocusNode.dispose();
    _pagingController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    EasyDebounce.debounce(
      'search-debouncer',
      const Duration(milliseconds: 500),
      () {
        ref.read(searchFiltersProvider.notifier).setQuery(query);
        _pagingController.refresh();
      },
    );
  }

  void _showSortBottomSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Consumer(
          builder: (context, ref, child) {
            final currentSort = ref.watch(searchFiltersProvider).sort;
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ترتيب حسب', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 16),
                    _buildSortOption(context, ref, 'الأحدث', 'recent', currentSort),
                    _buildSortOption(context, ref, 'السعر: من الأقل للأعلى', 'price_asc', currentSort),
                    _buildSortOption(context, ref, 'السعر: من الأعلى للأقل', 'price_desc', currentSort),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSortOption(BuildContext context, WidgetRef ref, String title, String value, String? currentSort) {
    return ListTile(
      title: Text(title),
      trailing: currentSort == value ? const Icon(Icons.check, color: Colors.blue) : null,
      onTap: () {
        ref.read(searchFiltersProvider.notifier).setSort(value);
        _pagingController.refresh();
        Navigator.pop(context);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final filters = ref.watch(searchFiltersProvider);

    return Scaffold(
      appBar: AppBar(
        title: _buildSearchBar(),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {
              // Open detailed filters bottom sheet or dialog if needed
              // For now we will show sort and condition via chips below
              _showSortBottomSheet();
            },
          )
        ],
      ),
      body: Column(
        children: [
          _buildFilterChips(filters),
          Expanded(
            child: ValueListenableBuilder<PagingState<int, Listing>>(
              valueListenable: _pagingController,
              builder: (context, state, child) {
                return PagedGridView<int, Listing>(
                  state: state,
                  fetchNextPage: _pagingController.fetchNextPage,
                  padding: const EdgeInsets.all(8),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.65,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                  ),
                  builderDelegate: PagedChildBuilderDelegate<Listing>(
                    itemBuilder: (context, listing, index) {
                      return ListingCard(
                        listing: listing,
                        onTap: () {
                          ref.read(searchFiltersProvider.notifier).onResultClicked(listing.id, index);
                          context.push('/listings/${listing.id}');
                        },
                      );
                    },
                    firstPageProgressIndicatorBuilder: (_) => const Center(
                      child: CircularProgressIndicator(),
                    ),
                    newPageProgressIndicatorBuilder: (_) => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(8.0),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    noItemsFoundIndicatorBuilder: (_) => _buildNoItemsFound(),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return RawAutocomplete<String>(
      textEditingController: _searchController,
      focusNode: _searchFocusNode,
      optionsBuilder: (TextEditingValue textEditingValue) async {
        if (textEditingValue.text.isEmpty) {
          return const Iterable<String>.empty();
        }
        
        final suggestions = await ref.read(searchRepositoryProvider).getSearchSuggestions(textEditingValue.text);
        return suggestions;
      },
      onSelected: (String selection) {
        _searchController.text = selection;
        _onSearchChanged(selection);
        _searchFocusNode.unfocus();
      },
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            hintText: 'ابحث عن...',
            border: InputBorder.none,
            filled: true,
            fillColor: Colors.grey[200],
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20),
              borderSide: BorderSide.none,
            ),
            suffixIcon: IconButton(
              icon: const Icon(Icons.clear, size: 20),
              onPressed: () {
                controller.clear();
                _onSearchChanged('');
              },
            ),
          ),
          onChanged: _onSearchChanged,
          onSubmitted: (value) {
            onFieldSubmitted();
            _onSearchChanged(value);
          },
          textInputAction: TextInputAction.search,
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(8)),
            ),
            child: SizedBox(
              width: MediaQuery.of(context).size.width - 96,
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final option = options.elementAt(index);
                  return ListTile(
                    leading: const Icon(Icons.search, size: 18),
                    title: Text(option),
                    onTap: () {
                      onSelected(option);
                    },
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterChips(SearchFilters filters) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          FilterChip(
            label: const Text('الكل'),
            selected: filters.condition == null,
            onSelected: (selected) {
              if (selected) {
                ref.read(searchFiltersProvider.notifier).setCondition(null);
                _pagingController.refresh();
              }
            },
          ),
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('جديد'),
            selected: filters.condition == 'new',
            onSelected: (selected) {
              ref.read(searchFiltersProvider.notifier).setCondition(selected ? 'new' : null);
              _pagingController.refresh();
            },
          ),
          const SizedBox(width: 8),
          FilterChip(
            label: const Text('مستعمل'),
            selected: filters.condition == 'used',
            onSelected: (selected) {
              ref.read(searchFiltersProvider.notifier).setCondition(selected ? 'used' : null);
              _pagingController.refresh();
            },
          ),
        ],
      ),
    );
  }

  Widget _buildNoItemsFound() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off, size: 80, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'لم يتم العثور على نتائج',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'جرب كلمات مفتاحية مختلفة',
            style: TextStyle(color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }
}
