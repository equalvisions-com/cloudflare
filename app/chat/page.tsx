import { Metadata } from 'next';
import { ChatPage } from '../../components/chat/ChatPage';
import { ChatProvider } from '@/lib/contexts/ChatContext';
import { StandardSidebarLayout } from '@/components/ui/StandardSidebarLayout';
import { LAYOUT_CONSTANTS } from '@/lib/layout-constants';
import { NotificationsWidgetServer } from '@/components/widgets/NotificationsWidgetServer';
import { SidebarSearch } from '@/components/search/SidebarSearch';
import { TrendingWidget } from '@/components/trending/TrendingWidget';
import { TrendingWidgetSkeleton } from '@/components/trending/TrendingWidgetSkeleton';
import { FeaturedPostsWidget } from '@/components/widgets/FeaturedPostsWidget';
import { FeaturedPostsWidgetSkeleton } from '@/components/widgets/FeaturedPostsWidgetSkeleton';
import { LegalWidget } from '@/components/widgets/LegalWidget';
import { Suspense } from 'react';

// Add the Edge Runtime configuration at the top of the file
export const runtime = 'edge';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

/* ----------  a. Page-level meta  ---------- */
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.SITE_URL;
  
  return {
    title: 'AI Chat – FocusFix',
    description: 'Chat with AI about newsletters, podcasts, and content discovery. Get personalized recommendations.',
    alternates: { canonical: `${siteUrl}/chat` },
    openGraph: {
      title: 'AI Chat – FocusFix',
      description: 'Chat with AI about newsletters, podcasts, and content discovery.',
      url: `${siteUrl}/chat`,
      type: 'website'
    },
    twitter: { card: 'summary_large_image', title: 'AI Chat on FocusFix' }
  };
}

export default function Page() {
  const siteUrl = process.env.SITE_URL;

  /** Optimized JSON-LD using @graph structure */
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/chat#breadcrumbs`,
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": `${siteUrl}/` },
          { "@type": "ListItem", "position": 2, "name": "AI Chat", "item": `${siteUrl}/chat` }
        ]
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/chat#webapp`,
        "name": "FocusFix AI Chat Assistant",
        "url": `${siteUrl}/chat`,
        "applicationCategory": "ChatApplication",
        "operatingSystem": "Web Browser",
        "inLanguage": "en",
        "isAccessibleForFree": true,
        "featureList": [
          "Personalised newsletter recommendations",
          "Podcast discovery assistance",
          "Real-time AI responses"
        ],
        "potentialAction": {
          "@type": "InteractAction",
          "target": {
            "@type": "EntryPoint",
            "url": `${siteUrl}/chat`,
            "actionPlatform": [
              "http://schema.org/DesktopWebPlatform",
              "http://schema.org/MobileWebPlatform"
            ]
          }
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/chat#software`,
        "name": "FocusFix AI Assistant",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Any",
        "inLanguage": "en",
        "isAccessibleForFree": true,
        "url": `${siteUrl}/chat`
      }
    ]
  });

  return (
    <>
      <script
        id="chat-schema"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      
      <div className="fixed inset-0 md:static md:inset-auto w-full">
        <StandardSidebarLayout
          rightSidebar={
            <div className="sticky top-6">
              <div className="flex flex-col gap-6">
                {/* Search Component */}
                <SidebarSearch />
                
                {/* Notifications Widget */}
                <NotificationsWidgetServer />
                
                {/* Trending Widget */}
                <Suspense fallback={<TrendingWidgetSkeleton />}>
                  <TrendingWidget />
                </Suspense>
                
                {/* Featured Posts Widget */}
                <Suspense fallback={<FeaturedPostsWidgetSkeleton />}>
                  <FeaturedPostsWidget />
                </Suspense>
                
                {/* Legal Widget */}
                <LegalWidget />
              </div>
            </div>
          }
          containerClass={LAYOUT_CONSTANTS.CONTAINER_CLASS}
          mainContentClass={LAYOUT_CONSTANTS.MAIN_CONTENT_CLASS}
          rightSidebarClass={LAYOUT_CONSTANTS.RIGHT_SIDEBAR_CLASS}
        >
          <ChatProvider>
            <ChatPage />
          </ChatProvider>
        </StandardSidebarLayout>
      </div>
    </>
  );
}
