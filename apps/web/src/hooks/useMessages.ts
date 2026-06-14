import useSWRInfinite from 'swr/infinite';
import { api } from '@/lib/api/auth';
import { Message } from '@/types/message';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export const useMessages = (conversationId: string | null) => {
  const getKey = (pageIndex: number, previousPageData: any) => {
    if (!conversationId) return null;
    if (previousPageData && !previousPageData.hasMore) return null; // reached the end
    return `/messages/${conversationId}?page=${pageIndex + 1}&limit=20`; // API endpoint
  };

  const { data, error, size, setSize, mutate } = useSWRInfinite<{
    data: Message[];
    hasMore: boolean;
  }>(getKey, fetcher, {
    revalidateOnFocus: false,
  });

  const messages = data ? data.flatMap(page => page.data) : [];
  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.data.length === 0;
  const isReachingEnd =
    isEmpty || (data && data[data.length - 1]?.data.length < 20) || (data && data[data.length - 1]?.hasMore === false);

  return {
    messages,
    error,
    isLoadingMore,
    size,
    setSize,
    isReachingEnd,
    mutate,
  };
};
