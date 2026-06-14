import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/listing_repository.dart';
import '../../data/models/listing.dart';

final listingRepositoryProvider = Provider((ref) => ListingRepository());

final listingDetailsProvider = FutureProvider.family<Listing, String>((ref, id) async {
  final repository = ref.read(listingRepositoryProvider);
  return repository.getListingDetails(id);
});
