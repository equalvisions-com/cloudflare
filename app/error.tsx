'use client'

import { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { usePathname, useRouter } from 'next/navigation'

// Error page component - displayed when server-side errors occur
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Log the error to an error reporting service
  useEffect(() => {
    console.error('Application error:', error)
    
    // Attempt to detect if this is a cold start connection timeout
    const isColdStartError = 
      error.message?.includes('timeout') || 
      error.message?.includes('network') ||
      error.message?.includes('connection') ||
      error.message?.includes('failed to fetch')
    
    if (isColdStartError) {
      console.log('Detected cold start error, will attempt auto-retry')
      
      // For cold start errors, auto-retry after a short delay
      const timer = setTimeout(() => {
        reset()
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [error, reset])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">Something went wrong!</h1>
      
      <p className="max-w-md text-lg text-muted-foreground">
        {error.message || 'An unexpected error occurred while loading the page.'}
      </p>
      
      <div className="mt-6 flex gap-4">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        
        <Button onClick={() => router.push('/')} variant="outline">
          Go home
        </Button>
      </div>
      
      <p className="mt-8 text-sm text-muted-foreground">
        If this problem persists, please refresh your browser or try again later.
      </p>
    </div>
  )
} 