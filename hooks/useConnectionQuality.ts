'use client';

import { useState, useCallback, useRef } from 'react';

interface ConnectionQuality {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface UseConnectionQualityReturn {
  quality: ConnectionQuality | null;
  isSlowConnection: boolean;
  shouldReduceQuality: boolean;
  checkConnection: () => void;
}

/**
 * useConnectionQuality - Lightweight connection monitoring
 * 
 * Uses Navigator Connection API when available
 * No useEffect - manual checking to avoid performance impact
 */
export const useConnectionQuality = (): UseConnectionQualityReturn => {
  const [quality, setQuality] = useState<ConnectionQuality | null>(null);
  const lastCheckRef = useRef<number>(0);
  
  const checkConnection = useCallback(() => {
    // Throttle checks to once per 30 seconds
    const now = Date.now();
    if (now - lastCheckRef.current < 30000) return;
    lastCheckRef.current = now;
    
    if (typeof window === 'undefined') return;
    
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      setQuality({
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
      });
    }
  }, []);

  const isSlowConnection = quality ? 
    ['slow-2g', '2g'].includes(quality.effectiveType) || 
    quality.downlink < 0.5 || 
    quality.rtt > 2000 : false;

  const shouldReduceQuality = quality ? 
    isSlowConnection || quality.saveData : false;

  return {
    quality,
    isSlowConnection,
    shouldReduceQuality,
    checkConnection,
  };
}; 