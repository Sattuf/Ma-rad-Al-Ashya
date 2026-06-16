import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:go_router/go_router.dart';
import '../../../transactions/data/repositories/promotions_repository.dart';
import '../../../transactions/presentation/providers/promotions_provider.dart';

class PromoteListingScreen extends ConsumerStatefulWidget {
  final String listingId;

  const PromoteListingScreen({
    super.key,
    required this.listingId,
  });

  @override
  ConsumerState<PromoteListingScreen> createState() => _PromoteListingScreenState();
}

class _PromoteListingScreenState extends ConsumerState<PromoteListingScreen> {
  PromotionPlan? _selectedPlan;
  bool _isLoading = false;

  Future<bool?> _showMockPaymentDialog(PromotionPlan plan) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            title: const Text('محاكاة عملية الدفع (Stripe Sandbox)'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('الخطة: ${plan.name}'),
                const SizedBox(height: 8),
                Text('السعر: \$${plan.price}'),
                const SizedBox(height: 16),
                const Text(
                  'لقد تم اكتشاف بيئة تجريبية/موجّه محلي. هل ترغب في محاكاة نجاح الدفع؟',
                  style: TextStyle(fontSize: 14),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text(
                  'إلغاء',
                  style: TextStyle(color: Colors.red),
                ),
              ),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('نجاح الدفع'),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _handlePayment() async {
    if (_selectedPlan == null) return;
    
    setState(() {
      _isLoading = true;
    });

    try {
      final repo = ref.read(promotionsRepositoryProvider);
      final paymentIntent = await repo.createPaymentIntent(widget.listingId, _selectedPlan!);
      final clientSecret = paymentIntent['clientSecret'] as String? ?? '';
      final isMock = paymentIntent['isMock'] as bool? ?? false;

      bool isSuccess = false;

      if (isMock || clientSecret.startsWith('mock_secret')) {
        final mockResult = await _showMockPaymentDialog(_selectedPlan!);
        isSuccess = mockResult ?? false;
      } else {
        try {
          await Stripe.instance.initPaymentSheet(
            paymentSheetParameters: SetupPaymentSheetParameters(
              paymentIntentClientSecret: clientSecret,
              merchantDisplayName: 'معرض الأشياء',
              style: ThemeMode.light,
            ),
          );
          await Stripe.instance.presentPaymentSheet();
          isSuccess = true;
        } catch (e) {
          if (e is StripeException) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('فشلت عملية الدفع: ${e.error.localizedMessage}')),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('حدث خطأ غير متوقع أثناء الدفع: $e')),
            );
          }
        }
      }

      if (isSuccess) {
        // Save the promotion locally
        await repo.saveLocalPromotion(
          widget.listingId,
          _selectedPlan!.id,
          _selectedPlan!.durationDays,
        );

        // Invalidate promotions providers to refresh data
        ref.invalidate(myPromotionsProvider);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('تم ترويج الإعلان بنجاح! 🚀'),
              backgroundColor: Colors.green,
            ),
          );
          context.pop();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('فشل إنشاء عملية الدفع: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final plansAsync = ref.watch(promotionsPlansProvider);

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('ترويج الإعلان'),
          centerTitle: true,
        ),
        body: plansAsync.when(
          data: (plans) {
            if (plans.isEmpty) {
              return const Center(child: Text('لا توجد خطط ترويجية متوفرة حالياً.'));
            }
            
            // Set initial selected plan if not set
            _selectedPlan ??= plans.first;

            return Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: plans.length,
                    itemBuilder: (context, index) {
                      final plan = plans[index];
                      final isSelected = _selectedPlan?.id == plan.id;
                      final isPremium = plan.id == 'premium';

                      // UI styles for Premium plan
                      final gradient = isPremium
                          ? const LinearGradient(
                              colors: [Color(0xFFFFD700), Color(0xFFFFA500), Color(0xFFFF8C00)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null;

                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedPlan = plan;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            gradient: gradient,
                            color: isPremium ? null : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isSelected
                                  ? (isPremium ? Colors.orange.shade800 : Theme.of(context).primaryColor)
                                  : Colors.grey.shade300,
                              width: isSelected ? 3.0 : 1.0,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(isSelected ? 0.15 : 0.05),
                                blurRadius: isSelected ? 12 : 6,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        plan.name,
                                        style: TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          color: isPremium ? Colors.brown.shade900 : Colors.black87,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: isPremium ? Colors.brown.shade900.withOpacity(0.15) : Colors.grey.shade100,
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        '\$${plan.price}',
                                        style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: isPremium ? Colors.brown.shade900 : Theme.of(context).primaryColor,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'المدة: ${plan.durationDays} يوم',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: isPremium ? Colors.brown.shade800 : Colors.grey.shade600,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  plan.description,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: isPremium ? Colors.brown.shade800 : Colors.black54,
                                  ),
                                ),
                                const Divider(height: 24, thickness: 1),
                                ...plan.features.map(
                                  (feat) => Padding(
                                    padding: const EdgeInsets.only(bottom: 6.0),
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.check_circle,
                                          color: isPremium ? Colors.brown.shade900 : Colors.green,
                                          size: 18,
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            feat,
                                            style: TextStyle(
                                              fontSize: 13,
                                              color: isPremium ? Colors.brown.shade900 : Colors.black87,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handlePayment,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      backgroundColor: _selectedPlan?.id == 'premium' ? Colors.orange.shade700 : Theme.of(context).primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 4,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          )
                        : Text(
                            'ترويج الآن (${_selectedPlan?.name.split(' ').first ?? ''})',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, s) => Center(child: Text('حدث خطأ في تحميل الخطط: $e')),
        ),
      ),
    );
  }
}
