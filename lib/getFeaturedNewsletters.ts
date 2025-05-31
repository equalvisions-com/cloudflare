import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

interface FeaturedNewsletter {
  position: number;
  url: string;
  name: string;
  description?: string;
  image?: string;
}

export async function getFeaturedNewsletters(): Promise<FeaturedNewsletter[]> {
  /* 10 featured posts, minimal fields */
  const { featured } = await fetchQuery(api.categories.getCategorySliderData, {
    mediaType: 'newsletter',
    postsPerCategory: 10
  });

  const siteUrl = process.env.SITE_URL || 'https://localhost:3000';

  /* normalise only the data we need for schema */
  return featured.posts.slice(0, 10).map((p: any, idx: number) => ({
    position: idx + 1,
    url: `${siteUrl}/newsletters/${p.postSlug}`,
    name: p.title,
    description: p.body || undefined, // Use the truncated body as description
    image: p.featuredImg || undefined // Include the featured image
  }));
} 