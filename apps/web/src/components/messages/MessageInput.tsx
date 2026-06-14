'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => void;
  onTyping: () => void;
}

export function MessageInput({ onSend, onTyping }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    // Typing indicator logic
    onTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    // Could add stopped typing logic if backend supports it
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white" dir="rtl">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={handleChange}
          placeholder="اكتب رسالة..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={20} className="mr-1" />
        </button>
      </div>
    </form>
  );
}
