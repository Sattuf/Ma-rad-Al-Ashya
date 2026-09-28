import { render, screen } from '@testing-library/react';
import { ListingCard } from '@/components/ListingCard';
import type { Listing } from '@/types/listing';

const listing: Listing = {
  id: '1',
  userId: 'user1',
  title: 'آيفون 15 برو بحالة ممتازة',
  description: 'استعمال خفيف',
  price: '1500.00', // DECIMAL arrives as a string from the API
  currency: 'USD',
  status: 'active',
  viewsCount: 3,
  category: { id: 'c1', name: 'جوالات', slug: 'phones' },
  images: [
    { id: 'i2', imageUrl: 'https://cdn.example/2.jpg', thumbnailUrl: 'https://cdn.example/2_t.jpg', sortOrder: 1 },
    { id: 'i1', imageUrl: 'https://cdn.example/1.jpg', thumbnailUrl: 'https://cdn.example/1_t.jpg', sortOrder: 0 },
  ],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ListingCard', () => {
  it('renders the server listing shape', () => {
    const { container } = render(<ListingCard listing={listing} />);
    expect(screen.getByRole('link', { name: 'آيفون 15 برو بحالة ممتازة' })).toHaveAttribute('href', '/listings/1');
    expect(screen.getByText('جوالات')).toBeInTheDocument();
    expect(screen.getByText(/1,500|١٬٥٠٠/)).toBeInTheDocument();
    // First image by sortOrder, thumbnail size
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/1_t.jpg');
  });

  it('shows a placeholder instead of crashing without images', () => {
    render(<ListingCard listing={{ ...listing, images: [] }} />);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('marks sold listings and hides favorites for guests', () => {
    render(<ListingCard listing={{ ...listing, status: 'sold' }} />);
    expect(screen.getByText('تم البيع')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /المفضلة/ })).not.toBeInTheDocument();
  });
});
