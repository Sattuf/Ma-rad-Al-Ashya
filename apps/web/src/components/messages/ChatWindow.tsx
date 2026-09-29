'use client';

import { errorMessage } from '@/lib/errors';
import { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useMessages } from '@/hooks/useMessages';
import { MessageInput } from './MessageInput';
import { getSocket } from '@/lib/socket';
import { Message } from '@/types/message';
import { Trash2, X } from 'lucide-react';
import { api } from '@/lib/api/auth';

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
}

export function ChatWindow({ conversationId, currentUserId }: ChatWindowProps) {
  const { messages, isLoadingMore, isReachingEnd, setSize, size, mutate } = useMessages(conversationId);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
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
          socket.emit('mark_read', { conversationId });
        }
      }
    };

    const handleMessageDeleted = ({ messageId, conversationId: cId }: { messageId: string, conversationId: string }) => {
      if (cId === conversationId) {
        mutate(
          (currentData) => {
            if (!currentData) return currentData;
            return currentData.map((page) => ({
              ...page,
              data: page.data.filter((m: Message) => m.id !== messageId)
            }));
          },
          false
        );
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

    // The other participant read up to a position: mark my messages up to it, locally.
    const handleMessageRead = ({ conversationId: cId, userId, lastReadMessageId }: {
      conversationId: string;
      userId: string;
      lastReadMessageId: string;
    }) => {
      if (cId !== conversationId || userId === currentUserId) return;
      const upTo = BigInt(lastReadMessageId);
      mutate(
        (currentData) =>
          currentData?.map((page) => ({
            ...page,
            data: page.data.map((m) =>
              m.senderId === currentUserId && !m.isRead && BigInt(m.id) <= upTo ? { ...m, isRead: true } : m,
            ),
          })),
        false,
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('typing', handleTyping);
    socket.on('message_read', handleMessageRead);

    return () => {
      socket.emit('leave_conversation', conversationId);
      socket.off('new_message', handleNewMessage);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('typing', handleTyping);
      socket.off('message_read', handleMessageRead);
    };
  }, [conversationId, mutate, currentUserId]);

  const handleSend = (content: string) => {
    const socket = getSocket();
    // Socket.IO buffers emits while disconnected and flushes them on reconnect.
    setChatError(socket.connected ? null : 'أنت غير متصل الآن؛ ستُرسل رسالتك تلقائياً عند عودة الاتصال.');
    socket.emit('send_message', {
      conversationId,
      content,
      senderId: currentUserId,
    });
  };

  const handleSendImage = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await api.post(`/conversations/${conversationId}/messages/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // the new message will come via socket, or we can mutate locally
    } catch (error) {
      setChatError(errorMessage(error, 'لم تُرسل الصورة. حاول مجدداً.'));
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await api.delete(`/conversations/${conversationId}/messages/${messageId}`);
      // Optimistically remove
      mutate(
        (currentData) => {
          if (!currentData) return currentData;
          return currentData.map((page) => ({
            ...page,
            data: page.data.filter((m: Message) => m.id !== messageId)
          }));
        },
        false
      );
    } catch (error) {
      setChatError(errorMessage(error, 'تعذّر حذف الرسالة. حاول مجدداً.'));
    }
  };

  const handleTyping = () => {
    const socket = getSocket();
    socket.emit('typing', { conversationId, userId: currentUserId });
  };

  const displayMessages = [...messages].reverse();

  return (
    <>
      <div className="flex flex-col h-full bg-gray-50" dir="rtl">
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {!isReachingEnd && (
            <div ref={loadMoreRef} className="py-2 text-center text-sm text-gray-500">
              {isLoadingMore ? 'جارٍ التحميل…' : 'تحميل الرسائل السابقة'}
            </div>
          )}
          
          {displayMessages.map((msg: Message) => {
            const isMine = msg.senderId === currentUserId;
            // Check if message is less than 5 minutes old
            const isDeletable = isMine && (new Date().getTime() - new Date(msg.createdAt).getTime() < 5 * 60 * 1000);
            
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[70%] ${isMine ? 'self-end' : 'self-start'} group`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                <div className={`flex items-center gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isMine
                        ? 'bg-primary text-on-primary rounded-te-none'
                        : 'bg-surface text-gray-900 border border-gray-200 rounded-ts-none'
                    }`}
                  >
                    {msg.type === 'image' && msg.imageUrl ? (
                      <div className="mb-2 cursor-pointer" onClick={() => setFullscreenImage(msg.imageUrl!)}>
                        <img src={msg.imageUrl} alt="Message Attachment" className="max-w-full h-auto rounded-lg max-h-60 object-cover" />
                      </div>
                    ) : null}
                    
                    {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                    
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMine ? 'text-brand-100' : 'text-gray-400'}`}>
                      <span>{new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMine && (
                        <span className="me-1 tracking-tighter">
                          {msg.isRead ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {isDeletable && hoveredMessageId === msg.id && (
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      title="حذف الرسالة"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          
          {typingUsers.size > 0 && (
            <div className="self-start bg-surface border border-gray-200 px-4 py-2 rounded-2xl rounded-ts-none text-gray-500 text-sm flex items-center gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {chatError && (
          <div role="alert" className="flex items-center justify-between gap-3 border-t border-line bg-danger-soft px-4 py-2 text-sm text-danger">
            <span>{chatError}</span>
            <button type="button" onClick={() => setChatError(null)} className="min-h-11 px-2 font-medium" aria-label="إخفاء الرسالة">إغلاق</button>
          </div>
        )}
        <MessageInput onSend={handleSend} onSendImage={handleSendImage} onTyping={handleTyping} />
      </div>

      {fullscreenImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 start-4 text-white hover:text-gray-300 p-2 rounded-full hover:bg-surface/10 transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={fullscreenImage}
            alt="Fullscreen Attachment"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </>
  );
}
