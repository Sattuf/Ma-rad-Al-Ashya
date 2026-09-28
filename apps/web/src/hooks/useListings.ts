import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { listingsApi } from '@/lib/api/listings';
import { ListingsQuery } from '@/types/listing';
import { searchApi, type SearchPage } from '@/lib/api/search';

/**
 * Paginated listings. With search text the pages come from the ranked A/B search
 * (see searchApi.page); `variant` tells the page whether to report result clicks.
 */
export function useListings(query: ListingsQuery = {}) {
  const getKey = (pageIndex: number, previousPageData: SearchPage | null) => {
    if (previousPageData && previousPageData.meta.page >= previousPageData.meta.lastPage) return null;
    return ['/listings', { ...query, page: pageIndex + 1 }];
  };

  const fetcher = async ([, params]: [string, ListingsQuery]) => searchApi.page(params);

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus: false,
  });

  const listings = data ? data.flatMap(page => page.data) : [];
  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.data.length === 0;
  const last = data?.[data.length - 1];
  const isReachingEnd = isEmpty || (!!last && last.meta.page >= last.meta.lastPage);
  const total = data?.[0]?.meta.total ?? 0;
  const variant = data?.[0]?.variant ?? null;

  return {
    listings,
    error,
    isLoading: isLoadingInitialData,
    isLoadingMore,
    isReachingEnd,
    size,
    setSize,
    isValidating,
    total,
    variant,
    retry: () => mutate(),
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
