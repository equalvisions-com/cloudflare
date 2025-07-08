import { type Metadata } from 'next';
import { memo, Suspense } from 'react';
import dynamicImport from 'next/dynamic';
import { getFeaturedPodcasts } from '@/lib/getFeaturedPodcasts';
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { PodcastsPageSkeleton } from "@/components/podcasts/PodcastsSkeleton";
import { PodcastsErrorFallback } from "@/components/podcasts/PodcastsErrorFallback";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PodcastItem } from '@/lib/types';

// Dynamic import of PodcastsWrapper with skeleton fallback
const PodcastsWrapper = dynamicImport(
  () => import("@/components/podcasts/PodcastsWrapper").then(mod => ({ default: mod.PodcastsWrapper })),
  {
    loading: () => <PodcastsPageSkeleton />,
  }
);

// Add the Edge Runtime configuration
export const runtime = 'edge';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

/* ----------  a. Page-level meta  ---------- */
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.SITE_URL;
  
  return {
    title: 'Best Podcasts to Listen – FocusFix',
    description: 'A curated list of the most useful podcasts in tech, design and business – updated daily.',
    alternates: { canonical: `${siteUrl}/podcasts` },
    openGraph: {
      title: 'Best Podcasts to Listen – FocusFix',
      description: 'A curated list of the most useful podcasts in tech, design and business – updated daily.',
      url: `${siteUrl}/podcasts`,
      type: 'website'
    },
    twitter: { card: 'summary_large_image', title: 'Best Podcasts to Listen' }
  };
}

// Memoized right sidebar component
const MemoizedRightSidebar = memo(() => (
  <RightSidebar showSearch={false} />
));

MemoizedRightSidebar.displayName = 'MemoizedRightSidebar';

/* ----------  b. Page component  ---------- */
const PodcastsPage = memo(async () => {
  /** 1. server fetch – no client code involved */
  const items = await getFeaturedPodcasts();
  
  const siteUrl = process.env.SITE_URL;

  // Transform items to match our PodcastItem type
  const typedItems: PodcastItem[] = items.map((item: any, index: number) => ({
    position: item.position || index + 1,
    url: item.url,
    name: item.name,
    description: item.description,
    image: item.image,
    category: item.category,
    feedUrl: item.feedUrl,
    lastUpdated: item.lastUpdated,
  }));

  /** 2. build all JSON-LD blocks in one string */
  const jsonLd = JSON.stringify([
    /* Breadcrumbs */
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Podcasts", item: `${siteUrl}/podcasts` }
      ]
    },
    /* Collection Page */
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Best Podcasts to Listen To",
      "description": "A curated list of the most useful podcasts in tech, design and business – updated daily.",
      "url": `${siteUrl}/podcasts`,
      "inLanguage": "en",
      "mainEntity": {
        "@type": "ItemList",
        "name": "Podcast Collection",
        "numberOfItems": typedItems.length
      }
    },
    /* Featured podcasts – ItemList */
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Featured podcasts",
      "itemListOrder": "https://schema.org/ItemListOrderAscending",
      "itemListElement": typedItems.map((i) => ({
        "@type": "ListItem",
        position: i.position,
        url: i.url,
        name: i.name,
        ...(i.description && { description: i.description }),
        ...(i.image && { image: i.image })
      }))
    }
  ]);

  /** 3. render the page – the <script> is part of the initial HTML */
  return (
    <>
      <script
        id="podcasts-schema"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <StandardSidebarLayout rightSidebar={<MemoizedRightSidebar />}>
        <main 
          className="w-full"
          role="main"
          aria-label="Podcasts directory"
        >
          <ErrorBoundary fallback={<PodcastsErrorFallback />}>
            <Suspense fallback={<PodcastsPageSkeleton />}>
              <PodcastsWrapper initialItems={typedItems} />
            </Suspense>
          </ErrorBoundary>
        </main>
      </StandardSidebarLayout>
    </>
  );
});

PodcastsPage.displayName = 'PodcastsPage';

export default PodcastsPage;
