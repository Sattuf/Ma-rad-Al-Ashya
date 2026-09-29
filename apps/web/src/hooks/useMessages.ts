import useSWRInfinite from 'swr/infinite';
import { fetchMessagingPage, MessagingPage, pageUrl } from './messagingPage';
import { Message } from '@/types/message';

export const useMessages = (conversationId: string | null) => {
  const getKey = (_pageIndex: number, previousPageData: MessagingPage<Message> | null) => {
    if (!conversationId) return null;
    return pageUrl(`/messages/${conversationId}`, previousPageData);
  };

  const { data, error, size, setSize, mutate } = useSWRInfinite<MessagingPage<Message>>(getKey, fetchMessagingPage, {
    revalidateOnFocus: false,
  });

  const messages = data ? data.flatMap(page => page.data) : [];
  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.data.length === 0;
  const isReachingEnd =
    isEmpty || (data && data[data.length - 1]?.hasMore === false);

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
