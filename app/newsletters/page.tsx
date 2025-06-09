import { type Metadata } from 'next';
import { memo, Suspense } from 'react';
import dynamicImport from 'next/dynamic';
import { getFeaturedNewsletters } from '@/lib/getFeaturedNewsletters';
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { NewslettersPageSkeleton } from "@/components/newsletters/NewslettersSkeleton";
import { NewslettersErrorFallback } from "@/components/newsletters/NewslettersErrorFallback";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NewsletterItem } from '@/lib/types';

// Dynamic import of NewslettersWrapper with skeleton fallback
const NewslettersWrapper = dynamicImport(
  () => import("@/components/newsletters/NewslettersWrapper").then(mod => ({ default: mod.NewslettersWrapper })),
  {
    loading: () => <NewslettersPageSkeleton />,
    ssr: false, // Disable SSR for better client-side performance
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
    title: 'Best Newsletters to Read – FocusFix',
    description: 'A curated list of the most useful newsletters in tech, design and business – updated daily.',
    alternates: { canonical: `${siteUrl}/newsletters` },
    openGraph: {
      title: 'Best Newsletters to Read – FocusFix',
      description: 'A curated list of the most useful newsletters in tech, design and business – updated daily.',
      url: `${siteUrl}/newsletters`,
      type: 'website'
    },
    twitter: { card: 'summary_large_image', title: 'Best Newsletters to Read' }
  };
}

// Memoized right sidebar component
const MemoizedRightSidebar = memo(() => (
  <RightSidebar showSearch={false} />
));

MemoizedRightSidebar.displayName = 'MemoizedRightSidebar';

/* ----------  b. Page component  ---------- */
const NewslettersPage = memo(async () => {
  /** 1. server fetch – no client code involved */
  const items = await getFeaturedNewsletters();
  
  const siteUrl = process.env.SITE_URL;

  // Transform items to match our NewsletterItem type
  const typedItems: NewsletterItem[] = items.map((item: any, index: number) => ({
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
        { "@type": "ListItem", position: 2, name: "Newsletters", item: `${siteUrl}/newsletters` }
      ]
    },
    /* Collection Page */
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Best Newsletters to Read",
      "description": "A curated list of the most useful newsletters in tech, design and business – updated daily.",
      "url": `${siteUrl}/newsletters`,
      "inLanguage": "en",
      "mainEntity": {
        "@type": "ItemList",
        "name": "Newsletter Collection",
        "numberOfItems": typedItems.length
      }
    },
    /* Featured newsletters – ItemList */
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Featured newsletters",
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
        id="newsletters-schema"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <StandardSidebarLayout rightSidebar={<MemoizedRightSidebar />}>
        <main 
          className="w-full"
          role="main"
          aria-label="Newsletters directory"
        >
          <ErrorBoundary fallback={<NewslettersErrorFallback />}>
            <Suspense fallback={<NewslettersPageSkeleton />}>
              <NewslettersWrapper initialItems={typedItems} />
            </Suspense>
          </ErrorBoundary>
        </main>
      </StandardSidebarLayout>
    </>
  );
});

NewslettersPage.displayName = 'NewslettersPage';

export default NewslettersPage;
