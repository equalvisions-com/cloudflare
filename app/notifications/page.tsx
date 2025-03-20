import { PostLayoutManager } from "@/components/postpage/PostLayoutManager";
import { Metadata } from "next";
import dynamic from "next/dynamic";

// Dynamically import the client component
const NotificationsClient = dynamic(() => import("@/app/notifications/NotificationsClient"), {
  ssr: false,
  loading: () => <div className="p-8">Loading notifications...</div>
});

export const metadata: Metadata = {
  title: "Notifications",
  description: "View your friend requests and other notifications",
};

export default function NotificationsPage() {
  // Create a minimal post object for the layout
  const dummyPost = {
    _id: "" as any,
    title: "Notifications",
    category: "Notifications",
    body: "",
    feedUrl: "",
    author: "",
    authorUrl: "",
    twitterUrl: "",
    websiteUrl: "",
    platform: "",
    categorySlug: ""
  };

  return (
    <PostLayoutManager post={dummyPost} relatedFollowStates={{}}>
      <NotificationsClient />
    </PostLayoutManager>
  );
}
