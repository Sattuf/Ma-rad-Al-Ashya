import { render, screen } from '@testing-library/react';
import { ListingCard } from '@/components/ListingCard';

const mockListing = {
  id: '1',
  title: 'فيلا فاخرة للبيع',
  description: 'فيلا جميلة جدا',
  price: 1500000,
  type: 'sale' as const,
  propertyType: 'villa' as const,
  bedrooms: 5,
  bathrooms: 4,
  area: 450,
  location: {
    lat: 24.7136,
    lng: 46.6753,
    address: 'حي الياسمين',
    city: 'الرياض',
  },
  features: ['مسبح', 'حديقة'],
  images: ['https://example.com/image.jpg'],
  status: 'active' as const,
  userId: 'user1',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

describe('ListingCard', () => {
  it('renders correctly', () => {
    render(<ListingCard listing={mockListing} />);
    
    expect(screen.getByText('فيلا فاخرة للبيع')).toBeInTheDocument();
    expect(screen.getByText('1,500,000 ر.س')).toBeInTheDocument();
    expect(screen.getByText('الرياض - حي الياسمين')).toBeInTheDocument();
    expect(screen.getByText('للبيع')).toBeInTheDocument();
    expect(screen.getByText('450 م²')).toBeInTheDocument();
  });
});
