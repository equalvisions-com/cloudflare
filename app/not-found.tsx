import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export const metadata: Metadata = {
  title: 'Page Not Found – FocusFix',
  description: 'The page you are looking for does not exist or has been moved.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  const siteUrl = process.env.SITE_URL;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Page Not Found",
    "description": "The requested page could not be found.",
    "url": `${siteUrl}/404`,
    "inLanguage": "en",
    "isPartOf": { "@id": `${siteUrl}/#website` }
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="max-w-md mx-auto text-center space-y-6">
          <h1 className="text-4xl font-bold">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </>
  );
} 