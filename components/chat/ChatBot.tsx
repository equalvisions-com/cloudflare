'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChatWidget } from '@/components/chat/ChatWidget';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 rounded-full w-12 h-12 flex items-center justify-center shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'X' : '?'}
      </Button>
      {isOpen && <ChatWidget setIsOpen={setIsOpen} />}
    </>
  );
}
