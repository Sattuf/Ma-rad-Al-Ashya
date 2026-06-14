import useSWR from 'swr';
import { transactionsApi } from '../lib/api/transactions';

export function useUserReviews(userId: string, page: number = 1, limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? ['/users/reviews', userId, page, limit] : null,
    () => transactionsApi.getUserReviews(userId, page, limit)
  );

  return {
    reviews: data?.data || [],
    pagination: data?.meta || null,
    isLoading,
    isError: error,
    mutate,
  };
}
