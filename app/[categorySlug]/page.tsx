import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export async function generateStaticParams() {
  const categories = await fetchQuery(api.posts.getAllCategories, {});
  return categories.map((category) => ({
    categorySlug: category.categorySlug,
  }));
}

export async function generateMetadata(props: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await props.params;
  const posts = await fetchQuery(api.posts.getPostsByCategory, {
    categorySlug,
  });

  if (!posts || posts.length === 0) {
    return {
      title: 'Category Not Found',
    };
  }

  return {
    title: posts[0].category,
    description: `Browse all posts in ${posts[0].category}`,
  };
}

export default async function CategoryPage(props: CategoryPageProps) {
  const { categorySlug } = await props.params;
  const posts = await fetchQuery(api.posts.getPostsByCategory, {
    categorySlug,
  });

  if (!posts || posts.length === 0) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 capitalize">
        {posts[0].category}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <Link
            key={post._id}
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
        ))}
      </div>
    </main>
  );
} 