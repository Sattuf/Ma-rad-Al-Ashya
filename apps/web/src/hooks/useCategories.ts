import useSWR from 'swr';
import { categoriesApi, flattenCategories } from '@/lib/api/categories';

export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR('/categories', categoriesApi.getTree, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
  });
  return { tree: data ?? [], flat: flattenCategories(data ?? []), error, isLoading, retry: () => mutate() };
}
