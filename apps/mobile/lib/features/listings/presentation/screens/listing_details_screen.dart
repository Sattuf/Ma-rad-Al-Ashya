import 'package:marad_mobile/core/utils/errors.dart';
import 'package:marad_mobile/core/utils/money.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';
import '../providers/listing_provider.dart';
import '../../data/models/listing.dart';
import 'package:marad_mobile/features/auth/presentation/providers/auth_provider.dart';
import 'package:marad_mobile/features/transactions/presentation/providers/transactions_provider.dart';
import 'package:marad_mobile/features/favorites/presentation/providers/favorites_provider.dart';
import 'package:go_router/go_router.dart';

import 'package:marad_mobile/core/services/analytics_service.dart';

class ListingDetailsScreen extends ConsumerStatefulWidget {
  final String listingId;

  const ListingDetailsScreen({super.key, required this.listingId});

  @override
  ConsumerState<ListingDetailsScreen> createState() => _ListingDetailsScreenState();
}

class _ListingDetailsScreenState extends ConsumerState<ListingDetailsScreen> {
  bool _hasTrackedView = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => 
      ref.read(favoritesProvider.notifier).checkFavorite(widget.listingId)
    );
  }

  void _trackView(Listing listing) {
    if (!_hasTrackedView) {
      _hasTrackedView = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(analyticsServiceProvider).trackEvent(
          'view',
          listingId: listing.id,
          categoryId: listing.category?.id,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final listingAsync = ref.watch(listingDetailsProvider(widget.listingId));
    final isFavorite = ref.watch(favoritesProvider)[widget.listingId] ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('تفاصيل الإعلان'),
        actions: [
          IconButton(
            icon: AnimatedScale(
              scale: isFavorite ? 1.2 : 1.0,
              duration: const Duration(milliseconds: 200),
              child: Icon(
                isFavorite ? Icons.favorite : Icons.favorite_border,
                color: isFavorite ? Colors.red : null,
              ),
            ),
            onPressed: () async {
              final success = await ref.read(favoritesProvider.notifier).toggleFavorite(widget.listingId);
              if (!success && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('حدث خطأ أثناء تحديث المفضلة')),
                );
              }
            },
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'report') {
                context.push('/report?type=listing&id=${widget.listingId}');
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'report',
                child: Row(
                  children: [
                    Icon(Icons.flag, color: Colors.red, size: 20),
                    SizedBox(width: 8),
                    Text('الإبلاغ عن الإعلان'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: listingAsync.when(
        data: (listing) {
          _trackView(listing);
          return SingleChildScrollView(
            child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (listing.images.isNotEmpty)
                CarouselSlider(
                  options: CarouselOptions(
                    height: 250.0,
                    enlargeCenterPage: true,
                    enableInfiniteScroll: listing.images.length > 1,
                    viewportFraction: 0.9,
                  ),
                  items: listing.images.map((img) {
                    return Builder(
                      builder: (BuildContext context) {
                        return Container(
                          width: MediaQuery.of(context).size.width,
                          margin: const EdgeInsets.symmetric(horizontal: 5.0),
                          decoration: BoxDecoration(
                            color: Colors.grey[200],
                            borderRadius: BorderRadius.circular(12),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: CachedNetworkImage(
                            imageUrl: img,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => const Center(child: CircularProgressIndicator()),
                            errorWidget: (context, url, error) => const Icon(Icons.error),
                          ),
                        );
                      },
                    );
                  }).toList(),
                )
              else
                Container(
                  height: 250,
                  width: double.infinity,
                  color: Colors.grey[200],
                  child: const Icon(Icons.image, size: 80, color: Colors.grey),
                ),
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      listing.title,
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      formatPrice(listing.price, listing.currency),
                      style: TextStyle(fontSize: 22, color: Theme.of(context).primaryColor, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: Colors.grey),
                        const SizedBox(width: 8),
                        Text(listing.location ?? 'غير محدد', style: const TextStyle(fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.category, color: Colors.grey),
                        const SizedBox(width: 8),
                        Text(listing.category?.name ?? 'غير محدد', style: const TextStyle(fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.info_outline, color: Colors.grey),
                        const SizedBox(width: 8),
                        Text('الحالة: ${listing.condition}', style: const TextStyle(fontSize: 16)),
                      ],
                    ),
                    if (listing.isSellerVerified) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.verified, color: Colors.blue),
                          const SizedBox(width: 8),
                          const Text('بائع موثّق ✓', style: TextStyle(fontSize: 16, color: Colors.blue, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                    const Divider(height: 32),
                    const Text(
                      'الوصف',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      listing.description,
                      style: const TextStyle(fontSize: 16, height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('تعذّر تحميل الإعلان. تحقّق من اتصالك ثم حاول مجدداً.', textAlign: TextAlign.center))),
      ),
      bottomNavigationBar: listingAsync.whenOrNull(
        data: (listing) {
          final authState = ref.watch(authProvider);
          final currentUserId = authState.user?['id'];
          final isSeller = currentUserId == listing.userId;
          final isActive = listing.status == 'active';

          if (!isSeller && isActive) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: ElevatedButton(
                  onPressed: () async {
                    if (currentUserId == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('الرجاء تسجيل الدخول أولاً')),
                      );
                      return;
                    }
                    try {
                      final repo = ref.read(transactionsRepositoryProvider);
                      final transaction = await repo.createTransaction(listing.id, listing.userId);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('تم طلب الشراء بنجاح!'), backgroundColor: Colors.green),
                      );
                      if (context.mounted) {
                        context.push('/transactions/${transaction.id}');
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(userMessage(e, 'تعذّر بدء الصفقة. حاول مجدداً.')), backgroundColor: Colors.red),
                        );
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).primaryColor,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('طلب شراء', style: TextStyle(fontSize: 18, color: Colors.white)),
                ),
              ),
            );
          }
          return null;
        },
      ),
    );
  }
}
