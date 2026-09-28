import useSWR from 'swr';
import { transactionsApi, type UserReviews } from '../lib/api/transactions';

export function useUserReviews(userId: string, page: number = 1, limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR<UserReviews>(
    userId ? ['/users/reviews', userId, page, limit] : null,
    () => transactionsApi.getUserReviews(userId, page, limit),
  );

  return {
    reviews: data?.reviews ?? [],
    summary: data?.summary ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}
