import { type Metadata } from 'next';
import { getFeaturedNewsletters } from '@/lib/getFeaturedNewsletters';
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { CategorySwipeableWrapper } from "@/components/ui/CategorySwipeableWrapper";

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

/* ----------  b. Page component  ---------- */
export default async function NewslettersPage() {
  /** 1. server fetch – no client code involved */
  const items = await getFeaturedNewsletters();
  
  const siteUrl = process.env.SITE_URL;

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
        "numberOfItems": items.length
      }
    },
    /* Featured newsletters – ItemList */
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Featured newsletters",
      "itemListOrder": "https://schema.org/ItemListOrderAscending",
      "itemListElement": items.map((i: any) => ({
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

      <StandardSidebarLayout rightSidebar={<RightSidebar showSearch={false} />}>
        <div className="w-full">
          <CategorySwipeableWrapper mediaType="newsletter" showEntries={true} />
        </div>
      </StandardSidebarLayout>
    </>
  );
}
