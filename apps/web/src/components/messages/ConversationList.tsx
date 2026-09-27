'use client';

import { useConversations } from '@/hooks/useConversations';
import { Conversation } from '@/types/message';

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { conversations, isLoadingMore, isReachingEnd, setSize, size } = useConversations();

  return (
    <div className="flex flex-col h-full border-e border-gray-200 bg-surface" dir="rtl">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold">الرسائل</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv: Conversation) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
              selectedId === conv.id ? 'bg-primary-soft' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
                  {conv.participants[0]?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {conv.participants[0]?.name || 'مستخدم غير معروف'}
                  </h3>
                  <p className="text-sm text-gray-500 truncate max-w-[180px]">
                    {conv.lastMessage?.content || 'لا توجد رسائل بعد'}
                  </p>
                </div>
              </div>
              {conv.unreadCount > 0 && (
                <div className="w-5 h-5 bg-primary text-on-primary text-xs rounded-full flex items-center justify-center">
                  {conv.unreadCount}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {!isReachingEnd && (
          <button
            onClick={() => setSize(size + 1)}
            disabled={isLoadingMore}
            className="w-full p-4 text-sm text-primary hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
          </button>
        )}
      </div>
    </div>
  );
}
