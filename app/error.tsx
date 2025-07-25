'use client'

import { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { usePathname, useRouter } from 'next/navigation'

// Note: Error pages are client components, so we add metadata via Head component
function ErrorPageHead() {
  useEffect(() => {
    // Set document title and meta description for error pages
    document.title = 'Error – FocusFix';
    
    // Add or update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'An error occurred while loading the page. Please try again.');
    
    // Add robots meta
    let metaRobots = document.querySelector('meta[name="robots"]');
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.setAttribute('name', 'robots');
      document.head.appendChild(metaRobots);
    }
    metaRobots.setAttribute('content', 'noindex, follow');

    // Add JSON-LD
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Error Page",
      "description": "An error occurred while loading the requested page.",
      "url": `${siteUrl}/error`,
      "inLanguage": "en",
      "isPartOf": { "@id": `${siteUrl}/#website` }
    };

    let scriptTag = document.querySelector('#error-schema') as HTMLScriptElement;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'error-schema';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(jsonLd);
  }, []);

  return null;
}

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

  // Handle error recovery
  useEffect(() => {
    // Attempt to detect if this is a cold start connection timeout
    const isColdStartError = 
      error.message?.includes('timeout') || 
      error.message?.includes('network') ||
      error.message?.includes('connection') ||
      error.message?.includes('failed to fetch')
    
    if (isColdStartError) {
      // For cold start errors, auto-retry after a short delay
      const timer = setTimeout(() => {
        reset()
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [error, reset])

  return (
    <>
      <ErrorPageHead />
      
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
    </>
  )
} 