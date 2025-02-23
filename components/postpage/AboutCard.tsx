import { Card, CardContent } from "@/components/ui/card";
import { GlobeIcon, TwitterLogoIcon } from "@radix-ui/react-icons";

interface AboutCardProps {
  category?: string;
  categorySlug?: string;
  author?: string;
  authorUrl?: string;
  platform?: string;
  websiteUrl?: string;
  twitterUrl?: string;
}

export const AboutCard = ({
  category,
  categorySlug,
  author,
  authorUrl,
  platform,
  websiteUrl,
  twitterUrl,
}: AboutCardProps) => {
  // Only show card if we have any metadata to display
  const hasMetadata = author || platform || websiteUrl || twitterUrl;
  if (!hasMetadata) return null;

  return (
    <Card className="h-fit shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">About</h2>
          
          <dl className="space-y-4">
            {/* Category */}
            {category && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Category</dt>
                <dd className="mt-1 text-sm">
                  {categorySlug ? (
                    <a 
                      href={`/${categorySlug}`}
                      className="text-primary hover:underline"
                    >
                      {category}
                    </a>
                  ) : (
                    category
                  )}
                </dd>
              </div>
            )}

            {/* Author - Show as link if URL exists, otherwise plain text */}
            {author && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Author</dt>
                <dd className="mt-1 text-sm">
                  {authorUrl ? (
                    <a 
                      href={authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {author}
                    </a>
                  ) : (
                    author
                  )}
                </dd>
              </div>
            )}

            {/* Platform */}
            {platform && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Platform</dt>
                <dd className="mt-1 text-sm">{platform}</dd>
              </div>
            )}

            {/* Links - Only show section if we have any links */}
            {(websiteUrl || twitterUrl) && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-2">Links</dt>
                <dd className="flex gap-3">
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      title="Website"
                    >
                      <GlobeIcon className="h-5 w-5" />
                    </a>
                  )}
                  {twitterUrl && (
                    <a
                      href={twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      title="Twitter"
                    >
                      <TwitterLogoIcon className="h-5 w-5" />
                    </a>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}; 