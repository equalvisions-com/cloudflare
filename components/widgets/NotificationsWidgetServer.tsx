import { getUserProfile } from "@/components/user-menu/UserMenuServer";
import { NotificationsWidget } from "./NotificationsWidget";

export async function NotificationsWidgetServer() {
  const { isAuthenticated } = await getUserProfile();
  
  return <NotificationsWidget isAuthenticated={isAuthenticated} />;
} 