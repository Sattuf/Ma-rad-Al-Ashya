'use client';

import Link from 'next/link';
import { MapPin, BedDouble, Bath, Square, Heart } from 'lucide-react';
import { Listing } from '@/types/listing';
import { useFavoriteCheck } from '@/hooks/useFavorite';

interface ListingCardProps {
  listing: Listing;
  onClick?: () => void;
}

export function ListingCard({ listing, onClick }: ListingCardProps) {
  const { isFavorite, toggleFavorite, isLoading } = useFavoriteCheck(listing.id);

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative h-48 w-full bg-gray-100">
        <Link href={`/listings/${listing.id}`} onClick={onClick}>
          <img
            src={listing.images[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80'}
            alt={listing.title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-primary">
          {listing.type === 'sale' ? 'للبيع' : 'للإيجار'}
        </div>
        <button 
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isLoading) await toggleFavorite();
          }}
          disabled={isLoading}
          className="absolute top-3 left-3 p-1.5 bg-white/50 hover:bg-white/90 backdrop-blur-sm rounded-full text-gray-500 transition-colors disabled:opacity-50 group-hover:block"
        >
          <Heart 
            size={18} 
            className={`transition-all duration-300 ${isFavorite ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-500 hover:text-red-500 hover:scale-110'}`} 
          />
        </button>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
            <Link href={`/listings/${listing.id}`} onClick={onClick} className="hover:text-primary">
              {listing.title}
            </Link>
          </h3>
          <p className="text-lg font-bold text-primary whitespace-nowrap mr-2">
            {listing.price.toLocaleString()} ر.س
          </p>
        </div>

        <div className="flex items-center text-gray-500 text-sm mb-4">
          <MapPin size={16} className="ml-1 shrink-0" />
          <span className="line-clamp-1">{listing.location.city} - {listing.location.address}</span>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          {listing.bedrooms && (
            <div className="flex items-center text-gray-600 text-sm">
              <BedDouble size={16} className="ml-1.5" />
              <span>{listing.bedrooms}</span>
            </div>
          )}
          {listing.bathrooms && (
            <div className="flex items-center text-gray-600 text-sm">
              <Bath size={16} className="ml-1.5" />
              <span>{listing.bathrooms}</span>
            </div>
          )}
          <div className="flex items-center text-gray-600 text-sm">
            <Square size={16} className="ml-1.5" />
            <span>{listing.area} م²</span>
          </div>
        </div>
      </div>
    </div>
  );
}
