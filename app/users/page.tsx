import type { Metadata } from "next";
import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { SearchInput } from "@/components/ui/search-input";
import { PeopleSearchWrapper } from "@/components/users/PeopleSearchWrapper";

export const runtime = 'edge';

export const dynamic = 'force-dynamic';

/* ───── a. Static meta ───── */
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.SITE_URL;

  return {
    title: "Discover People – FocusFix",
    description:
      "Browse 100,000+ public FocusFix members and see what newsletters & podcasts they follow.",
    alternates: { canonical: `${siteUrl}/users` },

    openGraph: {
      title: "People on FocusFix",
      description:
        "Explore public member profiles and follow interesting creators.",
      url: `${siteUrl}/users`,
      type: "website",
      images: [`${siteUrl}/og-images/people-directory.png`],
    },

    twitter: {
      card: "summary_large_image",
      title: "People on FocusFix",
      description:
        "Browse public FocusFix profiles and discover what they're reading.",
    },

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

/* ───── b. Page component ───── */
export default function PeoplePage() {
  const siteUrl = process.env.SITE_URL;

  /*  We keep schema *very light*:
      – BreadcrumbList, so GA / Search Console shows context
      – CollectionPage that represents the directory */
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/users#breadcrumbs`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${siteUrl}/`,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Users",
            "item": `${siteUrl}/users`,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/users`,
        "name": "People on FocusFix",
        "url": `${siteUrl}/users`,
        "description":
          "Directory of public FocusFix members and the creators they follow.",
        "inLanguage": "en",
        "isPartOf": { "@id": `${siteUrl}/#website` },
        "breadcrumb": { "@id": `${siteUrl}/users#breadcrumbs` },
        "mainEntity": {
          "@type": "ItemList",
          "name": "FocusFix members",
          /*  We *do not* expand 10k items here. Leaving ItemListElement empty
              is acceptable and avoids an extra DB call. If you ever want
              to pre-render, you could inject the top 20 profiles. */
          "itemListElement": [],
        },
      },
    ],
  });

  return (
    <>
      <script
        id="people-schema"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* Existing UI – keeps the client-search behaviour unchanged */}
      <StandardSidebarLayout rightSidebar={<RightSidebar showSearch={false} />}>
        <PeopleSearchWrapper />
      </StandardSidebarLayout>
    </>
  );
} 