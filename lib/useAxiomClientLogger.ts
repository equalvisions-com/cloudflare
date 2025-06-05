'use client'
import { useEffect, useRef } from 'react'
import { useLogger } from 'next-axiom'

export function useAxiomClientLogger() {
  const log = useLogger()
  const originalConsoleError = useRef<typeof console.error>()

  useEffect(() => {
    // Expose logger globally for ErrorBoundary (with safety check)
    if (typeof window !== 'undefined') {
      (window as any).__axiom_logger = log;
    }

    // Store original console.error for cleanup
    originalConsoleError.current = console.error;

    // Global error handler
    const handleError = (msg: string | Event, src?: string, lineno?: number, colno?: number, error?: Error) => {
      try {
        log.error('window.onerror', {
          msg: typeof msg === 'string' ? msg : msg.toString(),
          src,
          lineno,
          colno,
          stack: error?.stack,
          timestamp: new Date().toISOString(),
        })
      } catch (err) {
        console.warn('Failed to log error to Axiom:', err);
      }
    }

    // Unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      try {
        log.error('Promise rejection', {
          reason: event.reason,
          stack: event.reason?.stack,
          timestamp: new Date().toISOString(),
        })
      } catch (err) {
        console.warn('Failed to log promise rejection to Axiom:', err);
      }
    }

    // Console error override
    const enhancedConsoleError = (...args: any[]) => {
      try {
        log.error('console.error', { 
          args: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ),
          timestamp: new Date().toISOString(),
        })
      } catch (err) {
        console.warn('Failed to log console.error to Axiom:', err);
      }
      // Always call original console.error
      originalConsoleError.current?.(...args)
    }

    // Set up event listeners
    window.onerror = handleError
    window.onunhandledrejection = handleUnhandledRejection
    console.error = enhancedConsoleError

    // Cleanup function
    return () => {
      window.onerror = null
      window.onunhandledrejection = null
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current
      }
      // Clean up global logger reference
      if (typeof window !== 'undefined') {
        delete (window as any).__axiom_logger;
      }
    }
  }, [log])
} 