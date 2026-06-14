'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface MessageInputProps {
  onSend: (content: string) => void;
  onSendImage?: (file: File) => void;
  onTyping: () => void;
}

export function MessageInput({ onSend, onSendImage, onTyping }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile && onSendImage) {
      onSendImage(selectedFile);
      setSelectedFile(null);
      setPreview(null);
    } else if (message.trim()) {
      onSend(message.trim());
    }
    setMessage('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    // Typing indicator logic
    onTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setIsCompressing(true);
      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        setSelectedFile(compressedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error("Error compressing image:", error);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col border-t border-gray-200 bg-white" dir="rtl">
      {preview && (
        <div className="p-4 relative inline-block">
          <div className="relative inline-block border border-gray-200 rounded-lg overflow-hidden">
            <img src={preview} alt="Preview" className="h-24 w-auto object-cover" />
            <button
              type="button"
              onClick={clearSelection}
              className="absolute top-1 right-1 bg-gray-900/50 text-white rounded-full p-1 hover:bg-gray-900"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="p-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressing}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
          title="إرفاق صورة"
        >
          <ImageIcon size={24} />
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          type="text"
          value={message}
          onChange={handleChange}
          placeholder="اكتب رسالة..."
          disabled={!!selectedFile}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={(!message.trim() && !selectedFile) || isCompressing}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={20} className="mr-1" />
        </button>
      </form>
    </div>
  );
}
