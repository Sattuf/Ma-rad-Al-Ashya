import useSWRInfinite from 'swr/infinite';
import { fetchMessagingPage, pageQuery } from './messagingPage';
import { Message } from '@/types/message';

export const useMessages = (conversationId: string | null) => {
  const getKey = (pageIndex: number, previousPageData: any) => {
    if (!conversationId) return null;
    if (previousPageData && !previousPageData.hasMore) return null; // reached the end
    return `/messages/${conversationId}?${pageQuery(pageIndex)}`;
  };

  const { data, error, size, setSize, mutate } = useSWRInfinite<{
    data: Message[];
    hasMore: boolean;
  }>(getKey, fetchMessagingPage, {
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
