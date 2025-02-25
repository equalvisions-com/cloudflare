'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { Sparkles, X } from 'lucide-react';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 rounded-full flex items-center justify-center shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={toggleChat}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <>
            <X className="mr-0 h-4 w-4" />
            <span>Close</span>
          </>
        ) : (
          <>
            <Sparkles className="mr-0 h-4 w-4" />
            <span>Ask AI</span>
          </>
        )}
      </Button>
      {isOpen && <ChatWidget setIsOpen={setIsOpen} />}
    </>
  );
}
