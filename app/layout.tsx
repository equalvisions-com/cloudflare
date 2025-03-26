import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider, convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { UserMenuServer, getUserProfile } from "@/components/user-menu/UserMenuServer";
import { AudioProvider } from "@/components/audio-player/AudioContext";
import { PersistentPlayer } from "@/components/audio-player/PersistentPlayer";
import { MobileDock } from "@/components/ui/mobile-dock";
import { SidebarProvider } from "@/components/ui/sidebar-context";
import { NotificationProvider } from "@/components/ui/notification-context";
import dynamic from "next/dynamic";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dynamically import the ResetNotificationCounter with no SSR
const ResetNotificationCounter = dynamic(
  () => import("@/app/notifications/ResetNotificationCounter"),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Convex + Next.js + Convex Auth",
  description: "Generated by npm create convex",
  icons: {
    icon: "/convex.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get user profile information
  const { displayName, isAuthenticated } = await getUserProfile();

  return (
    <ConvexAuthNextjsServerProvider>
      {/* `suppressHydrationWarning` only affects the html tag,
      // and is needed by `ThemeProvider` which sets the theme
      // class attribute on it */}
      <html lang="en" suppressHydrationWarning>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
        </head>
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} antialiased no-overscroll`}
        >
          <ConvexClientProvider>
            <ThemeProvider attribute="class">
              <AudioProvider>
                <NotificationProvider>
                  <ResetNotificationCounter />
                  <SidebarProvider isAuthenticated={isAuthenticated} username={displayName}>
                    <div className="">
                      <div className="flex justify-end">
                        <UserMenuServer />
                      </div>
                      {children}
                    </div>
                    <PersistentPlayer />
                    <MobileDock />
                  </SidebarProvider>
                </NotificationProvider>
              </AudioProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
