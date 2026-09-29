import useSWRInfinite from 'swr/infinite';
import { fetchMessagingPage, MessagingPage, pageUrl } from './messagingPage';
import { Conversation } from '@/types/message';

export const useConversations = () => {
  const getKey = (_pageIndex: number, previousPageData: MessagingPage<Conversation> | null) => {
    return pageUrl('/conversations', previousPageData);
  };

  const { data, error, size, setSize, mutate } = useSWRInfinite<MessagingPage<Conversation>>(getKey, fetchMessagingPage);

  const conversations = data ? data.flatMap(page => page.data) : [];
  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.data.length === 0;
  const isReachingEnd =
    isEmpty || (data && data[data.length - 1]?.hasMore === false);

  return {
    conversations,
    error,
    isLoadingMore,
    size,
    setSize,
    isReachingEnd,
    mutate,
  };
};
