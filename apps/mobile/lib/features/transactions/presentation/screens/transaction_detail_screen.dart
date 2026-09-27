import 'package:marad_mobile/core/utils/errors.dart';
import 'package:marad_mobile/core/utils/money.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:marad_mobile/features/transactions/data/models/transaction_model.dart';
import 'package:marad_mobile/features/transactions/presentation/providers/transaction_detail_provider.dart';
import 'package:marad_mobile/features/transactions/presentation/providers/transactions_provider.dart';
import 'package:marad_mobile/features/transactions/presentation/utils/transaction_ui_helper.dart';
import 'package:marad_mobile/features/auth/presentation/providers/auth_provider.dart';

class TransactionDetailScreen extends ConsumerStatefulWidget {
  final String id;

  const TransactionDetailScreen({super.key, required this.id});

  @override
  ConsumerState<TransactionDetailScreen> createState() => _TransactionDetailScreenState();
}

class _TransactionDetailScreenState extends ConsumerState<TransactionDetailScreen> {
  bool _isUpdating = false;

  Future<void> _confirmTransaction() async {
    setState(() => _isUpdating = true);
    try {
      final repo = ref.read(transactionsRepositoryProvider);
      await repo.confirmTransaction(widget.id);
      ref.invalidate(transactionDetailProvider(widget.id));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('أكّدتَ الصفقة.'), backgroundColor: Colors.green),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userMessage(e, 'تعذّر تأكيد الصفقة. حاول مجدداً.')), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isUpdating = false);
    }
  }

  Future<void> _cancelTransaction() async {
    final reasonController = TextEditingController();
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('إلغاء الصفقة'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('هل أنت متأكد من إلغاء هذه الصفقة؟'),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'سبب الإلغاء (اختياري)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('تراجع'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('إلغاء الصفقة'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isUpdating = true);
    try {
      final repo = ref.read(transactionsRepositoryProvider);
      await repo.cancelTransaction(widget.id, reason: reasonController.text);
      ref.invalidate(transactionDetailProvider(widget.id));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('أُلغيت الصفقة.'), backgroundColor: Colors.orange),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userMessage(e, 'تعذّر إلغاء الصفقة. حاول مجدداً.')), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isUpdating = false);
    }
  }

  int _getStepFromStatus(TransactionStatus status) {
    switch (status) {
      case TransactionStatus.pendingSeller:
        return 0;
      case TransactionStatus.pendingBuyer:
        return 1;
      case TransactionStatus.completed:
        return 3;
      case TransactionStatus.cancelled:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(transactionDetailProvider(widget.id));
    final currentUserId = ref.watch(authProvider).user?['id'] ?? '';

    return Scaffold(
      appBar: AppBar(
        title: const Text('تفاصيل الصفقة'),
        centerTitle: true,
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(userMessage(err, 'تعذّر فتح الصفقة. حاول مجدداً.'), textAlign: TextAlign.center))),
        data: (transaction) {
          final isSeller = transaction.sellerId == currentUserId;
          final isBuyer = transaction.buyerId == currentUserId;
          final isCancelled = transaction.status == TransactionStatus.cancelled;
          final currentStep = _getStepFromStatus(transaction.status);
          
          final listingTitle = transaction.listing?['title'] ?? 'عنصر غير معروف';
          final listingImage = (transaction.listing?['images'] as List?)?.first ?? '';
          final listingPrice = transaction.listing?['price'] ?? 0.0;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Listing Info
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))
                    ]
                  ),
                  child: Row(
                    children: [
                      if (listingImage.isNotEmpty)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: CachedNetworkImage(
                            imageUrl: listingImage,
                            width: 80,
                            height: 80,
                            fit: BoxFit.cover,
                          ),
                        )
                      else
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: Colors.grey[200],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.image, color: Colors.grey),
                        ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(listingTitle, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            Text(formatPrice(num.tryParse('$listingPrice') ?? 0, '${transaction.listing?['currency'] ?? 'USD'}'), style: TextStyle(fontSize: 16, color: Theme.of(context).primaryColor)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 24),
                
                // Stepper
                if (!isCancelled) ...[
                  const Text('حالة الصفقة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Stepper(
                    physics: const NeverScrollableScrollPhysics(),
                    currentStep: currentStep > 3 ? 3 : currentStep,
                    controlsBuilder: (context, details) => const SizedBox.shrink(),
                    steps: [
                      Step(
                        title: const Text('طلب شراء'),
                        subtitle: Text(DateFormat('yyyy/MM/dd HH:mm').format(transaction.createdAt)),
                        content: const SizedBox.shrink(),
                        isActive: currentStep >= 0,
                        state: currentStep > 0 ? StepState.complete : StepState.indexed,
                      ),
                      Step(
                        title: const Text('تأكيد البائع'),
                        subtitle: transaction.sellerConfirmedAt != null 
                          ? Text(DateFormat('yyyy/MM/dd HH:mm').format(transaction.sellerConfirmedAt!))
                          : null,
                        content: const SizedBox.shrink(),
                        isActive: currentStep >= 1,
                        state: currentStep > 1 ? StepState.complete : StepState.indexed,
                      ),
                      Step(
                        title: const Text('تأكيد المشتري'),
                        subtitle: transaction.buyerConfirmedAt != null 
                          ? Text(DateFormat('yyyy/MM/dd HH:mm').format(transaction.buyerConfirmedAt!))
                          : null,
                        content: const SizedBox.shrink(),
                        isActive: currentStep >= 2,
                        state: currentStep > 2 ? StepState.complete : StepState.indexed,
                      ),
                      Step(
                        title: const Text('مكتملة'),
                        content: const SizedBox.shrink(),
                        isActive: currentStep >= 3,
                        state: currentStep >= 3 ? StepState.complete : StepState.indexed,
                      ),
                    ],
                  ),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.cancel, color: Colors.red, size: 48),
                        const SizedBox(height: 8),
                        const Text('الصفقة ملغاة', style: TextStyle(color: Colors.red, fontSize: 18, fontWeight: FontWeight.bold)),
                        if (transaction.cancelReason != null && transaction.cancelReason!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text('السبب: ${transaction.cancelReason}', textAlign: TextAlign.center),
                          ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 32),

                // Actions
                if (_isUpdating)
                  const Center(child: CircularProgressIndicator())
                else if (!isCancelled && transaction.status != TransactionStatus.completed) ...[
                  if (transaction.status == TransactionStatus.pendingSeller && isSeller)
                    ElevatedButton(
                      onPressed: _confirmTransaction,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Theme.of(context).primaryColor,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('تأكيد البيع', style: TextStyle(fontSize: 16)),
                    ),
                  if (transaction.status == TransactionStatus.pendingBuyer && isBuyer)
                    ElevatedButton(
                      onPressed: _confirmTransaction,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('تأكيد الاستلام', style: TextStyle(fontSize: 16)),
                    ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _cancelTransaction,
                    style: TextButton.styleFrom(foregroundColor: Colors.red),
                    child: const Text('إلغاء الصفقة'),
                  ),
                ],

                if (transaction.status == TransactionStatus.completed && !transaction.isReviewed) ...[
                  const Divider(),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => context.push('/transactions/${transaction.id}/review'),
                    icon: const Icon(Icons.star),
                    label: const Text('تقييم الطرف الآخر'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ]
              ],
            ),
          );
        },
      ),
    );
  }
}
