'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatWindow } from '@/components/messages/ChatWindow';
import { useAuthStore } from '@/lib/store/auth-store';

export default function MessagesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentUserId = useAuthStore((state) => state.user?.id) ?? '';

  // "/messages?c=<id>" (from "message the seller") opens that conversation directly.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) setSelectedId(c);
  }, []);

  const select = (id: string | null) => {
    setSelectedId(id);
    const url = id ? `/messages?c=${encodeURIComponent(id)}` : '/messages';
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="flex h-[calc(100dvh-64px)] overflow-hidden bg-surface">
      <div className={`${selectedId ? 'hidden md:block' : 'block'} h-full w-full shrink-0 md:w-1/3 lg:w-1/4`}>
        <ConversationList selectedId={selectedId} onSelect={select} />
      </div>

      <div className={`${selectedId ? 'flex' : 'hidden md:flex'} relative h-full flex-1 flex-col`}>
        {selectedId ? (
          <>
            <div className="flex items-center border-b border-line bg-surface p-2 md:hidden">
              <button
                type="button"
                onClick={() => select(null)}
                className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 font-medium text-primary hover:bg-primary-soft"
              >
                <ArrowRight className="h-4 w-4" aria-hidden /> كل المحادثات
              </button>
            </div>
            <ChatWindow conversationId={selectedId} currentUserId={currentUserId} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-canvas text-fg-muted">
            <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-surface-muted">
              <MessageSquare className="h-8 w-8 text-fg-subtle" aria-hidden />
            </span>
            <p className="text-lg">اختر محادثة لعرض الرسائل</p>
          </div>
        )}
      </div>
    </div>
  );
}
