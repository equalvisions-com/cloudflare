import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { NotificationsWidget } from "./NotificationsWidget";

export async function NotificationsWidgetServer() {
  // Check auth status using Convex token
  const token = await convexAuthNextjsToken().catch(() => null);
  const isAuthenticated = !!token;
  
  return <NotificationsWidget isAuthenticated={isAuthenticated} />;
} 