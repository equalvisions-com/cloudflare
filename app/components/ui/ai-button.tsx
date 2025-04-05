"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles } from "lucide-react";
import { memo } from "react";

interface AiButtonProps {
  className?: string;
}

export const AiButton = memo(function AiButton({ className = '' }: AiButtonProps) {
  return (
    <Button 
      variant="default" 
      asChild 
      className={`fixed bottom-6 right-6 rounded-full md:bottom-6 bottom-20 ${className}`}
    >
      <Link href="/chat" className="flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4" />
        Ask AI
      </Link>
    </Button>
  );
}); 