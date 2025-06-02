import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50_000;

export async function generateSitemaps() {
  // count rows without pulling them into memory
  const { postsCount, usersCount, staticPagesCount } =
    await fetchQuery(api.sitemap.getSitemapCounts, {});

  const total = postsCount + usersCount + staticPagesCount;
  const pages = Math.ceil(total / PAGE_SIZE);

  // Next.js will turn this into <sitemapindex> with loc=/sitemap/0, /sitemap/1 …
  return Array.from({ length: pages }, (_, i) => ({ id: i }));
} 