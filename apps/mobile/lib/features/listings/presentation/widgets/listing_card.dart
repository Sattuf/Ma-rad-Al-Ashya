import 'package:marad_mobile/core/utils/money.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../data/models/listing.dart';
import '../../../../features/favorites/presentation/providers/favorites_provider.dart';

class ListingCard extends ConsumerWidget {
  final Listing listing;
  final VoidCallback onTap;
  final Widget? badge;
  final Widget? bottomAction;

  const ListingCard({
    super.key,
    required this.listing,
    required this.onTap,
    this.badge,
    this.bottomAction,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavorite = ref.watch(favoritesProvider)[listing.id] ?? false;

    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (listing.images.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: listing.images.first,
                    height: 150,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(
                      height: 150,
                      color: Colors.grey[300],
                      child: const Center(child: CircularProgressIndicator()),
                    ),
                    errorWidget: (context, url, error) => Container(
                      height: 150,
                      color: Colors.grey[200],
                      child: const Icon(Icons.image_not_supported, size: 50, color: Colors.grey),
                    ),
                  )
                else
                  Container(
                    height: 150,
                    width: double.infinity,
                    color: Colors.grey[200],
                    child: const Icon(Icons.image, size: 50, color: Colors.grey),
                  ),
                Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        listing.title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        formatPrice(listing.price, listing.currency),
                        style: TextStyle(
                          fontSize: 16,
                          color: Theme.of(context).primaryColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.location_on, size: 16, color: Colors.grey),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              listing.location ?? 'غير محدد',
                              style: const TextStyle(color: Colors.grey, fontSize: 12),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (listing.conditionLabel != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                listing.conditionLabel!,
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (bottomAction != null) ...[
                  const Divider(height: 1, thickness: 1),
                  Padding(
                    padding: const EdgeInsets.only(left: 12.0, right: 12.0, bottom: 12.0),
                    child: bottomAction!,
                  ),
                ],
              ],
            ),
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white70,
                ),
                child: IconButton(
                  icon: AnimatedScale(
                    scale: isFavorite ? 1.2 : 1.0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      isFavorite ? Icons.favorite : Icons.favorite_border,
                      color: isFavorite ? Colors.red : Colors.grey,
                    ),
                  ),
                  onPressed: () async {
                    final success = await ref.read(favoritesProvider.notifier).toggleFavorite(listing.id);
                    if (!success && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('حدث خطأ أثناء تحديث المفضلة')),
                      );
                    }
                  },
                ),
              ),
            ),
            if (badge != null)
              Positioned(
                top: 8,
                right: 8,
                child: badge!,
              ),
          ],
        ),
      ),
    );
  }
}
