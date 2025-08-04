'use client'
import { useEffect } from 'react'
import { useLogger } from 'next-axiom'

export function LogClientErrors() {
  const log = useLogger()

  useEffect(() => {
    // Capture window.onerror events
    window.onerror = (msg, src, lineno, colno, error) => {
      log.error('window.onerror', {
        msg,
        src,
        lineno,
        colno,
        stack: error?.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      })
    }

    // Capture unhandled promise rejections
    window.onunhandledrejection = (event) => {
      log.error('unhandledrejection', {
        reason: event.reason,
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      })
    }

    // Patch console.error to capture console errors
    const original = console.error
    console.error = (...args) => {
      log.error('console.error', { 
        args: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      })
      original(...args)
    }

    // Cleanup function to restore original console.error
    return () => {
      console.error = original
    }
  }, [log])

  return null
} 