import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { MobileDock } from "@/components/ui/mobile-dock";
import { SidebarProvider } from "@/components/ui/sidebar-context";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { GlobalErrorBoundary } from "../components/GlobalErrorBoundary";
import { ScrollResetter } from "@/components/ui/scroll-resetter";
import { Toaster } from "@/components/ui/toaster";
import { AxiomWebVitals } from 'next-axiom';
import { LogClientErrors } from './log-client-errors';
import Script from "next/script";
import type { RootLayoutProps } from "@/lib/types";
import { cookies } from "next/headers";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ClientOnlyComponents } from "@/components/ClientOnlyComponents";

// Edge Runtime for optimal performance at scale
export const runtime = 'edge';

// Define viewport export for Next.js App Router
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', // Optimize font loading
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap', // Optimize font loading
});

export const metadata: Metadata = {
  title: "FocusFix – Discover Newsletters & Podcasts",
  description: "Discover and follow your favorite newsletters, podcasts, and content creators.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

// Root-level WebSite structured data for sitelinks search-box eligibility
// Memoized to prevent recreation on each request
const websiteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${process.env.SITE_URL}/#website`,
      "name": "FocusFix",
      "url": `${process.env.SITE_URL}/`,
      "description": "Discover and follow your favorite newsletters, podcasts, and content creators.",
      "inLanguage": "en",
      "logo": {
        "@type": "ImageObject",
        "url": `${process.env.SITE_URL}/logo.png`
      }
    },
    {
      "@type": "Organization",
      "@id": `${process.env.SITE_URL}/#organization`,
      "name": "FocusFix",
      "url": `${process.env.SITE_URL}/`,
      "logo": {
        "@type": "ImageObject",
        "url": `${process.env.SITE_URL}/logo.png`
      },
      "description": "Curated discovery platform for newsletters, podcasts and creators"
    }
  ]
} as const; // Mark as const for better optimization

export default async function RootLayout({ children }: RootLayoutProps) {
  // ✅ INSTANT AUTH HINTS: Get immediate hints from server-side cookies (no queries needed)
  const cookieStore = await cookies();
  const onboardedCookie = cookieStore.get('user_onboarded');
  
  // Check if Convex auth token exists (Convex sets this automatically)
  const hasConvexAuth = await convexAuthNextjsToken().catch(() => null);
  
  // ✅ MATCH MIDDLEWARE LOGIC: Auth + No onboarding cookie = redirect to onboarding
  // This means we should only show authenticated nav if BOTH conditions are met
  const isAuthenticated = !!hasConvexAuth;
  const isOnboarded = onboardedCookie?.value === 'true';
  
  // Create auth hints for client-side components that match middleware behavior
  const authHints = {
    // Only consider fully authenticated if they have auth AND onboarding cookie
    // This prevents showing authenticated nav to users who should be redirected
    isAuthenticated: isAuthenticated && isOnboarded,
    isOnboarded: isOnboarded
  };

  return (
    <ConvexAuthNextjsServerProvider>
      {/* `suppressHydrationWarning` only affects the html tag,
      // and is needed by `ThemeProvider` which sets the theme
      // class attribute on it */}
      <html 
        lang="en" 
        suppressHydrationWarning
        data-user-authenticated={authHints.isAuthenticated ? '1' : '0'}
        data-user-onboarded={authHints.isOnboarded ? '1' : '0'}
      >
        <head>
          <Script
            id="pianjs"
            src="https://api.pirsch.io/pa.js"
            data-code={process.env.NEXT_PUBLIC_PIRSCH_CODE!}
            strategy="lazyOnload"
          />
          
          {/* Root-level WebSite structured data for sitelinks search-box eligibility */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(websiteStructuredData, null, 2)
            }}
          />
          
          <Script
            id="theme-script"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch {}
            `,
            }}
          />
          
          {/* ✅ AUTH HINTS: Pass server-side auth state to client without queries */}
          <meta name="x-user-authenticated" content={authHints.isAuthenticated ? '1' : '0'} />
          <meta name="x-user-onboarded" content={authHints.isOnboarded ? '1' : '0'} />

          <script dangerouslySetInnerHTML={{
            __html: `
              // Intercept fetch to catch cache option usage
              (function() {
                const originalFetch = window.fetch;
                window.fetch = function(input, init) {
                  if (init && init.cache) {
                    console.error('🚨 FETCH WITH CACHE DETECTED:', {
                      url: typeof input === 'string' ? input : input.url,
                      cache: init.cache,
                      stack: new Error().stack,
                      timestamp: new Date().toISOString()
                    });
                  }
                  return originalFetch.apply(this, arguments);
                };
              })();
            `
          }} />
        </head>
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} antialiased no-overscroll min-h-screen flex flex-col force-scrollbar-stable`}
        >
          <GlobalErrorBoundary showDetails={true}>
            <ConvexClientProvider>
              <ThemeProvider attribute="class" enableSystem={true} disableTransitionOnChange={true}>
                <ClientOnlyComponents>
                  <SidebarProvider>
                    <ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center">
                      <p>Something went wrong. Please refresh the page.</p>
                    </div>}>
                      <ScrollResetter>
                        <div className="">
                          {children}
                        </div>
                        <MobileDock />
                      </ScrollResetter>
                    </ErrorBoundary>
                  </SidebarProvider>
                  <Toaster />
                </ClientOnlyComponents>
              </ThemeProvider>
            </ConvexClientProvider>
          </GlobalErrorBoundary>
          <LogClientErrors />
          <AxiomWebVitals />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
