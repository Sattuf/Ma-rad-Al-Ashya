import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { listingsApi } from '@/lib/api/listings';
import { ListingsQuery, Listing } from '@/types/listing';
import { PaginatedResponse } from '@/lib/api/listings';

export function useListings(query: ListingsQuery = {}) {
  const getKey = (pageIndex: number, previousPageData: PaginatedResponse<Listing> | null) => {
    if (previousPageData && !previousPageData.data.length) return null; // reached the end
    return ['/listings', { ...query, page: pageIndex + 1 }];
  };

  const fetcher = async ([, params]: [string, ListingsQuery]) => {
    return listingsApi.getListings(params);
  };

  const { data, error, size, setSize, isValidating } = useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus: false,
  });

  const listings = data ? data.flatMap(page => page.data) : [];
  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.data.length === 0;
  const isReachingEnd =
    isEmpty || (data && data[data.length - 1]?.data.length < (query.limit || 10));

  return {
    listings,
    error,
    isLoading: isLoadingInitialData,
    isLoadingMore,
    isReachingEnd,
    size,
    setSize,
    isValidating,
  };
}

export function useListingDetail(id?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/listings/${id}` : null,
    () => listingsApi.getListing(id!)
  );

  return {
    listing: data,
    isLoading,
    error,
    mutate,
  };
}

export function useMyListings() {
  const { data, error, isLoading, mutate } = useSWR('/listings/my-listings', listingsApi.getMyListings);

  return {
    listings: data || [],
    isLoading,
    error,
    mutate,
  };
}
