import { Card, CardContent } from "@/components/ui/card";
import { GlobeIcon, TwitterLogoIcon } from "@radix-ui/react-icons";

// Post data required for the sidebar
interface PostSidebarData {
  title: string;
  category: string;
  body: string;
  author?: string;
  authorUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  platform?: string;
  categorySlug?: string;
}

interface ProfileSidebarContentProps extends PostSidebarData {
  className?: string;
  children?: React.ReactNode;
}

export const ProfileSidebarContent = ({
  className,
  children,
  category,
  author,
  authorUrl,
  twitterUrl,
  websiteUrl,
  platform,
  categorySlug,
}: ProfileSidebarContentProps) => {
  // Only show stats card if we have any metadata to display
  const hasMetadata = author || platform || websiteUrl || twitterUrl;

  return (
    <div className={`${className} space-y-6`}>
  

      {/* Stats and Metadata Card - Only show if we have metadata */}
      {hasMetadata && (
        <Card className="h-fit shadow-none mt-6">
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
                          className="text-muted-foreground hover:text-primary"
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
                          className="text-muted-foreground hover:text-primary"
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
      )}

      {/* Activity Feed Card */}
      <Card className="h-fit shadow-none">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-4">Activity Feed</h2>
          <div className="rounded-lg bg-accent/10 p-4 overflow-y-auto max-h-96">
            {children || (
              <p className="text-sm text-muted-foreground">
                Recent activity will appear here.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 