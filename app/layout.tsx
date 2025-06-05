import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ConvexAuthNextjsServerProvider, convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { UserMenuServer, getUserProfile } from "@/components/user-menu/UserMenuServer";
import { MobileDock } from "@/components/ui/mobile-dock";
import { SidebarProvider } from "@/components/ui/sidebar-context";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import dynamic from "next/dynamic";
import { ScrollResetter } from "@/components/ui/scroll-resetter";
import { Toaster } from "@/components/ui/toaster";
import { AxiomWebVitals } from 'next-axiom';
import { LogClientErrors } from './log-client-errors';
import Script from "next/script";

// Dynamically import audio components with ssr disabled
const AudioProvider = dynamic(
  () => import("@/components/audio-player/AudioContext").then(mod => mod.AudioProvider),
  { ssr: false }
);

const PersistentPlayer = dynamic(
  () => import("@/components/audio-player/PersistentPlayer").then(mod => mod.PersistentPlayer),
  { ssr: false }
);

// Dynamically import floating chat button with ssr disabled
const FloatingChatButton = dynamic(
  () => import("@/components/FloatingChatButton"),
  { ssr: false }
);

// Define viewport export for Next.js App Router
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
};

// Separate component for user data with Suspense
const UserData = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center">
      <p>Could not load user data. Please try refreshing the page.</p>
    </div>}>
      <Suspense fallback={<div className="min-h-screen"></div>}>
        <UserDataLoader>
          {children}
        </UserDataLoader>
      </Suspense>
    </ErrorBoundary>
  );
};

// Async component that loads user data
async function UserDataLoader({ children }: { children: React.ReactNode }) {
  // Add a timeout to prevent infinite loading during cold starts
  const profilePromise = Promise.race([
    getUserProfile(),
    new Promise<any>((resolve) => setTimeout(() => {
      // Return default values if profile loading times out
      resolve({
        displayName: "Guest", 
        username: "Guest", 
        isAuthenticated: false, 
        isBoarded: false, 
        profileImage: undefined, 
        userId: null, 
        pendingFriendRequestCount: 0
      });
    }, 5000)) // 5 second timeout
  ]);
  
  const { displayName, username, isAuthenticated, isBoarded, profileImage, userId, pendingFriendRequestCount } = await profilePromise;
  
  // If we have user data from Convex, we can trust the isBoarded value
  // This is the single source of truth
  
  return (
    <SidebarProvider 
      isAuthenticated={isAuthenticated} 
      username={username}
      displayName={displayName}
      isBoarded={isBoarded}
      profileImage={profileImage}
      userId={userId}
      pendingFriendRequestCount={pendingFriendRequestCount}
    >
      {children}
    </SidebarProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      {/* `suppressHydrationWarning` only affects the html tag,
      // and is needed by `ThemeProvider` which sets the theme
      // class attribute on it */}
      <html lang="en" suppressHydrationWarning>
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
        </head>
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} antialiased no-overscroll min-h-screen flex flex-col`}
        >
          <ConvexClientProvider>
            <ThemeProvider attribute="class" enableSystem={true} disableTransitionOnChange={true}>
              <AudioProvider>
                <UserData>
                  <ScrollResetter>
                    <div className="">
                      <div className="hidden">
                        <Suspense fallback={null}>
                          <UserMenuServer />
                        </Suspense>
                      </div>
                      {children}
                    </div>
                    <PersistentPlayer />
                    <MobileDock />
                  </ScrollResetter>
                </UserData>
                <Toaster />
              </AudioProvider>
            </ThemeProvider>
          </ConvexClientProvider>
          <FloatingChatButton />
          <LogClientErrors />
          <AxiomWebVitals />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
