import useSWR from 'swr';
import { transactionsApi, type Deal } from '../lib/api/transactions';
import { listingsApi } from '../lib/api/listings';
import { userApi, type PublicProfile } from '../lib/api/users';
import type { Listing } from '@/types/listing';

export function useTransactions(role: 'buyer' | 'seller', status?: string, page: number = 1, limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR(['/transactions', role, status, page, limit], () =>
    transactionsApi.getTransactions(role, status, page, limit),
  );
  return {
    transactions: data?.items ?? [],
    total: data?.total ?? 0,
    lastPage: data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1,
    isLoading,
    error,
    mutate,
  };
}

export function useTransaction(id: string) {
  const { data, error, isLoading, mutate } = useSWR(id ? ['/transactions', id] : null, () => transactionsApi.getTransaction(id));
  return { transaction: data ?? null, isLoading, error, mutate };
}

/**
 * Listing and people behind a set of deals, fetched in two batch requests (the ids
 * lookup does not count views and still finds listings that have since sold).
 */
export function useDealDetails(deals: Deal[], me?: string) {
  const listingIds = [...new Set(deals.map((d) => d.listingId))];
  const peopleIds = [...new Set(deals.flatMap((d) => [d.sellerId, d.buyerId]).filter((id) => id !== me))];

  const { data: listings } = useSWR(listingIds.length ? ['deal-listings', ...listingIds] : null, async () => {
    const page = await listingsApi.getListings({ ids: listingIds.join(','), limit: listingIds.length });
    return new Map<string, Listing>(page.data.map((l) => [l.id, l]));
  });
  const { data: people } = useSWR(peopleIds.length ? ['deal-people', ...peopleIds] : null, async () => {
    const found = await Promise.allSettled(peopleIds.map((id) => userApi.getUser(id)));
    return new Map<string, PublicProfile>(found.flatMap((r, i) => (r.status === 'fulfilled' ? [[peopleIds[i], r.value] as const] : [])));
  });
  return { listings, people };
}
