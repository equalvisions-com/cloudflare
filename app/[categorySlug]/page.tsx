import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cache } from "react";
import { Id } from "@/convex/_generated/dataModel";

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

interface Post {
  _id: Id<"posts">;
  title: string;
  category: string;
  categorySlug: string;
  postSlug: string;
  featuredImg?: string;
}

// Cache the category fetch
const getCategoryPosts = cache(async (categorySlug: string) => {
  const posts = await fetchQuery(api.posts.getPostsByCategory, {
    categorySlug,
  });
  if (!posts || posts.length === 0) return null;
  return posts;
});

export async function generateStaticParams() {
  const categories = await fetchQuery(api.posts.getAllCategories, {});
  return categories.map((category) => ({
    categorySlug: category.categorySlug,
  }));
}

export async function generateMetadata(props: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await props.params;
  const posts = await getCategoryPosts(categorySlug);

  if (!posts) {
    return {
      title: 'Category Not Found',
    };
  }

  return {
    title: posts[0].category,
    description: `Browse all posts in ${posts[0].category}`,
  };
}

// Post card component with loading state
function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/${post.categorySlug}/${post.postSlug}`}
      className="group"
    >
      <article className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
        {post.featuredImg && (
          <div className="relative w-full h-48">
            <Image
              src={post.featuredImg}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
              loading="lazy"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
            {post.category}
          </span>
        </div>
      </article>
    </Link>
  );
}

// Async posts list component
async function PostsList({ categorySlug }: { categorySlug: string }) {
  const posts = await getCategoryPosts(categorySlug);
  
  if (!posts) {
    notFound();
  }

  return (
    <>
      <h1 className="text-4xl font-bold mb-8 capitalize">
        {posts[0].category}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <Suspense 
            key={post._id} 
            fallback={
              <div className="border rounded-lg overflow-hidden animate-pulse">
                <div className="bg-muted h-48 w-full" />
                <div className="p-4">
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </div>
              </div>
            }
          >
            <PostCard post={post} />
          </Suspense>
        ))}
      </div>
    </>
  );
}

export default async function CategoryPage(props: CategoryPageProps) {
  const { categorySlug } = await props.params;

  return (
    <main className="container mx-auto px-4 py-8">
      <Suspense 
        fallback={
          <div className="space-y-8">
            <div className="h-12 bg-muted rounded w-1/3 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="border rounded-lg overflow-hidden animate-pulse">
                  <div className="bg-muted h-48 w-full" />
                  <div className="p-4">
                    <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <PostsList categorySlug={categorySlug} />
      </Suspense>
    </main>
  );
}