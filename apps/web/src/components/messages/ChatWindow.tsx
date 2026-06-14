'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useMessages } from '@/hooks/useMessages';
import { MessageInput } from './MessageInput';
import { getSocket } from '@/lib/socket';
import { Message } from '@/types/message';

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
}

export function ChatWindow({ conversationId, currentUserId }: ChatWindowProps) {
  const { messages, isLoadingMore, isReachingEnd, setSize, size, mutate } = useMessages(conversationId);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { ref: loadMoreRef, inView } = useInView();

  useEffect(() => {
    if (inView && !isReachingEnd && !isLoadingMore) {
      setSize(size + 1);
    }
  }, [inView, isReachingEnd, isLoadingMore, setSize, size]);

  // Scroll to bottom on initial load or new message
  useEffect(() => {
    if (messagesEndRef.current) {
      // Only scroll down automatically if we are already near the bottom,
      // but for simplicity we will just scroll to bottom when a new message arrives.
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, typingUsers.size]);

  useEffect(() => {
    const socket = getSocket();
    
    socket.emit('join_conversation', conversationId);

    const handleNewMessage = (message: Message) => {
      if (message.conversationId === conversationId) {
        mutate(
          (currentData) => {
            if (!currentData) return currentData;
            const newData = [...currentData];
            // Add to the first page's start if we show newest at bottom
            newData[0] = {
              ...newData[0],
              data: [message, ...newData[0].data]
            };
            return newData;
          },
          false
        );
        // Mark as read if we are viewing it
        if (message.senderId !== currentUserId) {
          socket.emit('mark_read', { messageId: message.id, conversationId });
        }
      }
    };

    const handleTyping = ({ userId, conversationId: cId }: { userId: string, conversationId: string }) => {
      if (cId === conversationId && userId !== currentUserId) {
        setTypingUsers(prev => new Set(prev).add(userId));
        setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        }, 3000);
      }
    };

    const handleMessageRead = ({ messageId, conversationId: cId, readAt }: any) => {
      if (cId === conversationId) {
        mutate(); // Simplified: just re-fetch or rely on mutate to update UI
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('message_read', handleMessageRead);

    return () => {
      socket.emit('leave_conversation', conversationId);
      socket.off('new_message', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('message_read', handleMessageRead);
    };
  }, [conversationId, mutate, currentUserId]);

  const handleSend = (content: string) => {
    const socket = getSocket();
    socket.emit('send_message', {
      conversationId,
      content,
      senderId: currentUserId,
    });
  };

  const handleTyping = () => {
    const socket = getSocket();
    socket.emit('typing', { conversationId, userId: currentUserId });
  };

  // Messages are usually fetched newest first, we want to display newest at bottom.
  // We'll reverse the flattened messages for rendering.
  const displayMessages = [...messages].reverse();

  return (
    <div className="flex flex-col h-full bg-gray-50" dir="rtl">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {!isReachingEnd && (
          <div ref={loadMoreRef} className="py-2 text-center text-sm text-gray-500">
            {isLoadingMore ? 'جاري التحميل...' : 'تحميل الرسائل السابقة'}
          </div>
        )}
        
        {displayMessages.map((msg: Message) => {
          const isMine = msg.senderId === currentUserId;
          
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[70%] ${isMine ? 'self-end' : 'self-start'}`}
            >
              <div
                className={`px-4 py-2 rounded-2xl ${
                  isMine
                    ? 'bg-blue-600 text-white rounded-tl-none'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-tr-none'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                  <span>{new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMine && (
                    <span className="ml-1 tracking-tighter">
                      {msg.readAt ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {typingUsers.size > 0 && (
          <div className="self-start bg-white border border-gray-200 px-4 py-2 rounded-2xl rounded-tr-none text-gray-500 text-sm flex items-center gap-1">
            <span className="animate-bounce">.</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <MessageInput onSend={handleSend} onTyping={handleTyping} />
    </div>
  );
}
