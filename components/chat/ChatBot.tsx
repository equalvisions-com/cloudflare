'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChatWidget } from '@/components/chat/ChatWidget';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="fixed bottom-4 right-4 rounded-full w-12 h-12 flex items-center justify-center shadow-lg bg-blue-600 text-white hover:bg-blue-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'X' : '?'}
      </Button>
      {isOpen && <ChatWidget setIsOpen={setIsOpen} />}
    </>
  );
}