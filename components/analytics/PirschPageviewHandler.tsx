'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Extend the Window interface to include pirsch
declare global {
  interface Window {
    pirsch?: (event: string, options?: any) => void;
  }
}

export function PirschPageviewHandler() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.pirsch === 'function') {
      window.pirsch('pageview')
    }
  }, [pathname])

  return null
} 