export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  type: 'sale' | 'rent';
  propertyType: 'apartment' | 'house' | 'villa' | 'land' | 'commercial';
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
  };
  features: string[];
  images: string[];
  status: 'active' | 'pending' | 'sold' | 'rented';
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListingsQuery {
  page?: number;
  limit?: number;
  type?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  bedrooms?: number;
  userId?: string;
}
