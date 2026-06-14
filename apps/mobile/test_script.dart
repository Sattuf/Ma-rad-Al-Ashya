import 'package:flutter/material.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';

void main() {
  final controller = PagingController<int, String>(
    fetchPage: (pageKey) async { return ["A"]; },
    getNextPageKey: (state) {
      return (state.keys?.length ?? 0) + 1;
    },
  );
  
  final view = PagedGridView<int, String>(
    state: controller.state,
    fetchNextPage: controller.fetchNextPage,
    builderDelegate: PagedChildBuilderDelegate<String>(
      itemBuilder: (context, item, index) => Text(item),
    ),
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2),
  );
}
