import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:intl/intl.dart';
import 'package:marad_mobile/features/transactions/data/models/transaction_model.dart';
import 'package:marad_mobile/features/transactions/presentation/providers/transactions_provider.dart';
import 'package:marad_mobile/features/transactions/presentation/utils/transaction_ui_helper.dart';

class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});

  @override
  ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('المعاملات'),
        centerTitle: true,
        bottom: TabBar(
          controller: _tabController,
          labelColor: Theme.of(context).primaryColor,
          unselectedLabelColor: Colors.grey,
          indicatorColor: Theme.of(context).primaryColor,
          tabs: const [
            Tab(text: 'كمشتري'),
            Tab(text: 'كبائع'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _TransactionsList(role: 'buyer'),
          _TransactionsList(role: 'seller'),
        ],
      ),
    );
  }
}

class _TransactionsList extends ConsumerWidget {
  final String role;

  const _TransactionsList({required this.role});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(transactionsProvider(role));

    if (state.isLoading) {
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        itemBuilder: (context, index) => const _TransactionShimmer(),
      );
    }

    if (state.error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('حدث خطأ: ${state.error}', style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => ref.read(transactionsProvider(role).notifier).fetchTransactions(role: role),
              child: const Text('إعادة المحاولة'),
            )
          ],
        ),
      );
    }

    if (state.transactions.isEmpty) {
      return const Center(child: Text('لا توجد معاملات بعد'));
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(transactionsProvider(role).notifier).fetchTransactions(role: role),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: state.transactions.length,
        separatorBuilder: (context, index) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final transaction = state.transactions[index];
          return _TransactionCard(transaction: transaction, role: role);
        },
      ),
    );
  }
}

class _TransactionShimmer extends StatelessWidget {
  const _TransactionShimmer();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Shimmer.fromColors(
        baseColor: Colors.grey[300]!,
        highlightColor: Colors.grey[100]!,
        child: Container(
          height: 100,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}

class _TransactionCard extends StatelessWidget {
  final Transaction transaction;
  final String role;

  const _TransactionCard({required this.transaction, required this.role});

  @override
  Widget build(BuildContext context) {
    final statusColor = TransactionUIHelper.getStatusColor(transaction.status);
    final statusText = TransactionUIHelper.getStatusText(transaction.status);
    final isBuyer = role == 'buyer';
    
    // Attempt to extract display data if available in nested maps.
    final listingTitle = transaction.listing?['title'] ?? 'منتج غير معروف';
    final listingImage = (transaction.listing?['images'] as List?)?.first ?? '';
    
    final otherParty = isBuyer ? transaction.seller : transaction.buyer;
    final otherPartyName = otherParty?['name'] ?? 'مستخدم غير معروف';

    return GestureDetector(
      onTap: () => context.push('/transactions/${transaction.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            if (listingImage.isNotEmpty)
              CachedNetworkImage(
                imageUrl: listingImage,
                width: 100,
                height: 100,
                fit: BoxFit.cover,
                errorWidget: (context, url, error) => _buildPlaceholder(),
              )
            else
              _buildPlaceholder(),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      listingTitle,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${isBuyer ? 'البائع' : 'المشتري'}: $otherPartyName',
                      style: TextStyle(color: Colors.grey[600], fontSize: 14),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: statusColor.withOpacity(0.5)),
                          ),
                          child: Text(
                            statusText,
                            style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                        Text(
                          DateFormat('yyyy/MM/dd').format(transaction.createdAt),
                          style: TextStyle(color: Colors.grey[500], fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      width: 100,
      height: 100,
      color: Colors.grey[200],
      child: const Icon(Icons.image, color: Colors.grey),
    );
  }
}
