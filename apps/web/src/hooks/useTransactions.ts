import useSWR from 'swr';
import { transactionsApi } from '../lib/api/transactions';

export function useTransactions(role: 'buyer' | 'seller', status?: string, page: number = 1, limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    ['/transactions', role, status, page, limit],
    () => transactionsApi.getTransactions(role, status, page, limit)
  );

  return {
    transactions: data?.data || [],
    pagination: data?.meta || null,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useTransaction(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? ['/transactions', id] : null,
    () => transactionsApi.getTransaction(id)
  );

  return {
    transaction: data?.data || null,
    isLoading,
    isError: error,
    mutate,
  };
}
