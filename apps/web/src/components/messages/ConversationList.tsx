'use client';

import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MessageSquare } from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { userApi } from '@/lib/api/users';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Conversation } from '@/types/message';

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ConversationRow({ conv, me, selected, onSelect }: { conv: Conversation; me: string; selected: boolean; onSelect: () => void }) {
  const otherId = conv.participants.find((p) => p !== me) ?? conv.participants[0];
  // SWR dedupes by key, so the same person across conversations is fetched once.
  const { data: other } = useSWR(otherId ? ['/users', otherId] : null, () => userApi.getUser(otherId));
  const unread = conv.unreadCounts?.[me] ?? 0;
  const name = other?.name || 'مستخدم';
  const last = conv.lastMessage;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-3 border-b border-line p-4 text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring',
          selected ? 'bg-primary-soft' : 'hover:bg-surface-muted',
        )}
      >
        {other?.avatar ? (
          <img src={other.avatar} alt="" className="h-10 w-10 shrink-0 rounded-pill object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-surface-muted font-bold text-fg-muted" aria-hidden>
            {name.charAt(0)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate text-fg', unread ? 'font-bold' : 'font-medium')}>{name}</span>
            {conv.updatedAt && (
              <span className="shrink-0 text-xs text-fg-subtle">
                {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true, locale: ar })}
              </span>
            )}
          </span>
          <span className={cn('block truncate text-sm', unread ? 'text-fg' : 'text-fg-muted')}>
            {last ? (last.imageUrl && !last.content ? 'صورة' : last.content) : 'لا توجد رسائل بعد'}
          </span>
        </span>
        {unread > 0 && (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pill bg-primary px-1.5 text-xs text-on-primary" aria-label={`${unread} رسائل غير مقروءة`}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </li>
  );
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const me = useAuthStore((s) => s.user?.id) ?? '';
  const { conversations, error, isLoadingMore, isReachingEnd, setSize, size, mutate } = useConversations();
  const initialLoading = !error && conversations.length === 0 && isLoadingMore;

  return (
    <div className="flex h-full flex-col border-e border-line bg-surface">
      <div className="border-b border-line p-4">
        <h1 className="text-xl font-bold text-fg">الرسائل</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {initialLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error && conversations.length === 0 ? (
          <ErrorState error={error} title="تعذّر تحميل المحادثات" onRetry={() => mutate()} />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" aria-hidden />}
            title="لا توجد محادثات بعد"
            description="عندما تراسل بائعاً من صفحة إعلان، أو يراسلك مشترٍ، تظهر المحادثة هنا."
          />
        ) : (
          <ul>
            {conversations.map((conv) => (
              <ConversationRow key={conv.id} conv={conv} me={me} selected={selectedId === conv.id} onSelect={() => onSelect(conv.id)} />
            ))}
          </ul>
        )}

        {conversations.length > 0 && !isReachingEnd && (
          <div className="p-3">
            <Button variant="ghost" fullWidth loading={!!isLoadingMore} onClick={() => setSize(size + 1)}>
              عرض محادثات أقدم
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
