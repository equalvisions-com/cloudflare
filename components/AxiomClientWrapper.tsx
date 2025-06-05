'use client'
import { useAxiomClientLogger } from '@/lib/useAxiomClientLogger'
import { useEffect } from 'react'

export default function AxiomClientWrapper({ children }: { children: React.ReactNode }) {
  // Always call the hook (hooks must be called unconditionally)
  useAxiomClientLogger()

  // Add a safety check for client-side only operations
  useEffect(() => {
    // This ensures we're on the client side before any DOM operations
    if (typeof window === 'undefined') {
      console.warn('AxiomClientWrapper: Expected to run on client side only')
    }
  }, [])

  return <>{children}</>
} 