'use client';

import { useEffect } from 'react';
import { setOnboardedCookieAndRedirect } from './verification';

export default function AutoRedirect() {
  useEffect(() => {
    // Use the server action on the client side
    const redirect = async () => {
      try {
        await setOnboardedCookieAndRedirect();
      } catch (error) {
        console.error("Failed to redirect:", error);
        // Fallback to manual redirect if server action fails
        window.location.href = '/';
      }
    };
    
    redirect();
  }, []);
  
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 9999 }}>
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        textAlign: 'center'
      }}>
        <p>Redirecting you to the home page...</p>
      </div>
    </div>
  );
} 