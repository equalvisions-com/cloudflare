"use client";

import Link from "next/link";
import { 
  Home, 
  Podcast,
  Mail,
  User,
  MessageCircle,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { memo, useMemo, useCallback, useEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

interface MobileDockProps {
  className?: string;
}

// Memoized NavItem component to prevent unnecessary re-renders
const NavItem = memo(({ item, isActive }: { item: NavItem; isActive: boolean }) => (
  <Link 
    href={item.href} 
    className={cn(
      "flex flex-col items-center justify-center px-2",
      "transition-colors duration-200 ease-in-out h-12 w-12",
      isActive 
        ? "text-primary" 
        : "text-muted-foreground hover:text-foreground"
    )}
    aria-current={isActive ? "page" : undefined}
  >
    <item.icon 
      size={22} 
      strokeWidth={2}
    />
    <span className="sr-only">{item.label}</span>
  </Link>
));

NavItem.displayName = "NavItem";

// The main component is also memoized to prevent unnecessary re-renders
export const MobileDock = memo(function MobileDock({ className }: MobileDockProps) {
  const pathname = usePathname();
  const { username, isAuthenticated } = useSidebar();
  const navRef = useRef<HTMLElement>(null);
  
  // Detect iOS and apply consistent safe area padding
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;
    
    // Check if device is iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isIOS && navRef.current) {
      // Add a specific class for iOS Chrome if needed
      if (/CriOS/.test(navigator.userAgent)) {
        navRef.current.classList.add('ios-chrome');
      }
      
      // Force layout recalculation to avoid jittering on scroll
      const handleScroll = () => {
        if (navRef.current) {
          // Force a reflow to stabilize the position
          navRef.current.style.transform = 'translateZ(0)';
        }
      };
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, []);
  
  // Memoize the navItems array to prevent recreation on each render
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/", icon: Home, label: "Home" },
      { href: "/newsletters", icon: Mail, label: "Newsletters" },
      { href: "/podcasts", icon: Podcast, label: "Podcasts" },
      { href: "/people", icon: Users, label: "People" },
      { href: "/chat", icon: MessageCircle, label: "Chat" },
    ];
    
    // Add profile link based on authentication status
    items.push(
      isAuthenticated 
        ? { href: `/@${username}`, icon: User, label: "Profile" }
        : { href: "/signin", icon: User, label: "Sign In" }
    );
    
    return items;
  }, [username, isAuthenticated]);

  // Memoize the isActive check function
  const checkIsActive = useCallback((href: string) => {
    if (href === '/') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }, [pathname]);

  return (
    <nav 
      ref={navRef}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 content-center md:hidden",
        "bg-background/85 backdrop-blur-md border-t border-border",
        "flex flex-col mobile-dock",
        className
      )}
      style={{
        willChange: "transform",
        transform: "translateZ(0)"
      }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around w-full py-3">
        {navItems.map((item) => (
          <NavItem 
            key={item.href} 
            item={item} 
            isActive={checkIsActive(item.href)} 
          />
        ))}
      </div>
    </nav>
  );
});

// Add this to your global CSS file or create a style tag in your layout:
// .mobile-dock {
//   padding-bottom: max(16px, env(safe-area-inset-bottom));
// }

