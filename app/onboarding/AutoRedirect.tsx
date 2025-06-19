'use client';

import { useEffect } from 'react';
import { setOnboardedCookieAndRedirect } from './verification';
import { Loader2 } from 'lucide-react';

export default function AutoRedirect() {
  useEffect(() => {
    // Use the server action on the client side
    const redirect = async () => {
      try {
        await setOnboardedCookieAndRedirect();
      } catch (error) {
        // Fallback to manual redirect if server action fails - redirect to signin not home
        window.location.href = '/signin';
      }
    };
    
    redirect();
  }, []);
  
  return (
    <div className="fixed inset-0 bg-background z-[9999] flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
  );
} 