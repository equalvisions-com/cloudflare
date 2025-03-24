import { getUserProfile } from "@/components/user-menu/UserMenuServer";
import { NotificationsWidget } from "./NotificationsWidget";
import { NotificationsWidgetSkeleton } from "./NotificationsWidgetSkeleton";
import { Suspense } from "react";

export async function NotificationsWidgetServer() {
  const { isAuthenticated } = await getUserProfile();
  
  return (
    <Suspense fallback={<NotificationsWidgetSkeleton />}>
      <NotificationsWidget isAuthenticated={isAuthenticated} />
    </Suspense>
  );
} 