import 'package:flutter_test/flutter_test.dart';
import 'package:marad_mobile/features/listings/data/models/listing.dart';
import 'package:marad_mobile/features/listings/data/models/category.dart';

void main() {
  group('Listing Model', () {
    test('fromJson creates a valid Listing object', () {
      final json = {
        'id': '123',
        'title': 'Test Listing',
        'description': 'A description',
        'price': 100.5,
        'condition': 'new',
        'status': 'active',
        'images': ['http://example.com/image.jpg'],
        'category': {
          'id': 'cat1',
          'name': 'Electronics',
        },
        'location': 'Riyadh',
        'user_id': 'user123',
        'created_at': '2023-01-01T00:00:00.000Z',
      };

      final listing = Listing.fromJson(json);

      expect(listing.id, '123');
      expect(listing.title, 'Test Listing');
      expect(listing.price, 100.5);
      expect(listing.condition, 'new');
      expect(listing.images.length, 1);
      expect(listing.images.first, 'http://example.com/image.jpg');
      expect(listing.category?.id, 'cat1');
      expect(listing.category?.name, 'Electronics');
      expect(listing.location, 'Riyadh');
    });

    test('fromJson reads the listings-service shape (string price, image objects)', () {
      final listing = Listing.fromJson({
        'id': 'l1',
        'title': 'آيفون 15',
        'description': 'بحالة ممتازة',
        'price': '1250.50',
        'currency': 'USD',
        'status': 'active',
        'userId': 'u1',
        'createdAt': '2026-09-01T10:00:00.000Z',
        'images': [
          {'id': 'i2', 'imageUrl': 'https://cdn/2.jpg', 'thumbnailUrl': 'https://cdn/2t.jpg', 'sortOrder': 1},
          {'id': 'i1', 'imageUrl': 'https://cdn/1.jpg', 'thumbnailUrl': 'https://cdn/1t.jpg', 'sortOrder': 0},
        ],
      });

      expect(listing.price, 1250.5);
      expect(listing.currency, 'USD');
      expect(listing.userId, 'u1');
      expect(listing.images, ['https://cdn/1.jpg', 'https://cdn/2.jpg']);
    });

    test('toJson returns a valid map', () {
      final listing = Listing(
        id: '123',
        title: 'Test Listing',
        description: 'A description',
        price: 100.5,
        condition: 'new',
        status: 'active',
        images: ['http://example.com/image.jpg'],
        category: Category(id: 'cat1', name: 'Electronics'),
        location: 'Riyadh',
        userId: 'user123',
        createdAt: DateTime.utc(2023, 1, 1),
      );

      final json = listing.toJson();

      expect(json['id'], '123');
      expect(json['title'], 'Test Listing');
      expect(json['price'], 100.5);
      expect(json['category']['id'], 'cat1');
      expect(json['created_at'], '2023-01-01T00:00:00.000Z');
    });
  });
}
