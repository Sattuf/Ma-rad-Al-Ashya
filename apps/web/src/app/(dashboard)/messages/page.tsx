'use client';

import { useState } from 'react';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatWindow } from '@/components/messages/ChatWindow';
import { useAuthStore } from '@/lib/store/auth-store';

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  // Retrieve the current user from auth store or context.
  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id || '';

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-surface" dir="rtl">
      {/* Sidebar for Conversations */}
      <div 
        className={`${
          selectedConversationId ? 'hidden md:block' : 'block'
        } w-full md:w-1/3 lg:w-1/4 h-full shrink-0`}
      >
        <ConversationList 
          selectedId={selectedConversationId} 
          onSelect={(id) => setSelectedConversationId(id)} 
        />
      </div>

      {/* Main Chat Area */}
      <div 
        className={`${
          !selectedConversationId ? 'hidden md:flex' : 'flex'
        } flex-1 flex-col h-full relative`}
      >
        {selectedConversationId ? (
          <>
            <div className="md:hidden p-4 border-b border-gray-200 bg-surface flex items-center">
              <button 
                onClick={() => setSelectedConversationId(null)}
                className="text-primary font-medium"
              >
                &rarr; العودة للرسائل
              </button>
            </div>
            <ChatWindow 
              conversationId={selectedConversationId} 
              currentUserId={currentUserId} 
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-500">
            <div className="w-16 h-16 mb-4 rounded-full bg-gray-200 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg">اختر محادثة للبدء في المراسلة</p>
          </div>
        )}
      </div>
    </div>
  );
}
