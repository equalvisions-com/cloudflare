"use client";

import Link from "next/link";
import { 
  Home, 
  Podcast,
  Mail,
  User,
  Bookmark,
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { memo, useMemo, useCallback, useRef, useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  prefetch?: boolean;
}

interface MobileDockProps {
  className?: string;
}

// Memoized NavItem component to prevent unnecessary re-renders
const NavItem = memo(({ item, isActive }: { item: NavItem; isActive: boolean }) => (
  <Link 
    href={item.href}
    prefetch={item.prefetch === false ? false : true}
    className={cn(
      "flex flex-col items-center justify-center px-2 pb-2 relative",
      "transition-colors duration-200 ease-in-out h-12 w-12",
      isActive 
        ? "text-primary" 
        : "text-muted-foreground hover:text-foreground"
    )}
    aria-current={isActive ? "page" : undefined}
  >
    <item.icon 
      size={22} 
      strokeWidth={2.25}
    />
    <span className="sr-only">{item.label}</span>
  </Link>
));

NavItem.displayName = "NavItem";

// The main component with enhanced memoization and zero-flash auth hints
const MobileDockComponent = ({ className }: MobileDockProps) => {
  const pathname = usePathname();
  const { username, isAuthenticated, isLoading } = useSidebar();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // ✅ REACT BEST PRACTICE: Read auth hints synchronously during initial render
  // This follows React's purity rules by avoiding side effects in useEffect
  // and eliminates the post-render state update that caused unnecessary re-renders
  const authHints = useMemo(() => {
    if (typeof window === 'undefined') {
      return { isAuthenticated: undefined, isOnboarded: undefined };
    }
    
    const isAuthenticatedHint = document.documentElement.getAttribute('data-user-authenticated') === '1';
    const isOnboardedHint = document.documentElement.getAttribute('data-user-onboarded') === '1';
    
    return {
      isAuthenticated: isAuthenticatedHint,
      isOnboarded: isOnboardedHint
    };
  }, []); // Empty dependency array - hints are static after initial render
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ FLASH-FREE STATE: Use hints until real data loads, then switch to real data
  // Note: Hints follow middleware logic - authenticated users without onboarding cookies
  // are redirected to /onboarding, so hints only show authenticated nav for fully onboarded users
  const effectiveIsAuthenticated = authHints.isAuthenticated !== undefined 
    ? (isLoading ? authHints.isAuthenticated : isAuthenticated)
    : isAuthenticated;
  
  // Memoize the navItems array to prevent recreation on each render
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/", icon: Home, label: "Home", prefetch: false },
      { href: "/newsletters", icon: Mail, label: "Newsletters", prefetch: false },
      { href: "/podcasts", icon: Podcast, label: "Podcasts", prefetch: false },
      { href: "/chat", icon: MessageCircle, label: "AI Chat", prefetch: false },
    ];
    
    // ✅ ZERO FLASH: Add bookmarks only if authenticated (using effective state)
    if (effectiveIsAuthenticated) {
      items.push({ href: "/bookmarks", icon: Bookmark, label: "Bookmarks", prefetch: false });
    }
    
    // ✅ ZERO FLASH: Add profile link based on effective authentication state
    items.push(
      effectiveIsAuthenticated 
        ? { href: `/@${username}`, icon: User, label: "Profile", prefetch: false }
        : { href: "/signin", icon: User, label: "Sign In", prefetch: false }
    );
    
    return items;
  }, [username, effectiveIsAuthenticated]);

  // Memoize the isActive check function
  const checkIsActive = useCallback((href: string) => {
    if (!isMountedRef.current) return false;
    
    if (href === '/') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }, [pathname]);

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 content-center md:hidden",
        "bg-background/85 backdrop-blur-md border-border",
        "flex flex-col",
        className
      )}
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: "64px"
      }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around w-full h-[64px] pt-2">
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
};

// Export the memoized version of the component
export const MobileDock = memo(MobileDockComponent);

