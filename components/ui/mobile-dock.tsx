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
import { memo, useMemo, useCallback, useState, useEffect, useRef } from "react";
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
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const lastDirection = useRef<'up' | 'down'>('up');
  const ticking = useRef(false);
  const touchStart = useRef(0);
  const isIOS = useRef(false);
  
  // Check if using iOS Safari
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Detect iOS
    isIOS.current = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                    !(window as any).MSStream;
  }, []);
  
  // Handle scroll events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Add touch event handlers specifically for iOS Safari edge cases
    const handleTouchStart = (e: TouchEvent) => {
      touchStart.current = e.touches[0].clientY;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const touchY = e.touches[0].clientY;
          const direction = touchY < touchStart.current ? 'down' : 'up';
          
          // Get document height and window height to detect boundaries
          const docHeight = Math.max(
            document.body.scrollHeight, 
            document.documentElement.scrollHeight
          );
          const windowHeight = window.innerHeight;
          const scrolledToBottom = window.scrollY + windowHeight >= docHeight - 10;
          const scrolledToTop = window.scrollY <= 10;
          
          // Prevent showing at bottom when scrolling down slightly (iOS bounce effect)
          if (scrolledToBottom && direction === 'down') {
            setIsVisible(false);
          } 
          // Prevent hiding at top when scrolling up slightly (iOS bounce effect)
          else if (scrolledToTop && direction === 'up') {
            setIsVisible(true);
          }
          
          touchStart.current = touchY;
          ticking.current = false;
        });
        
        ticking.current = true;
      }
    };
    
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const direction = currentScrollY > lastScrollY.current ? 'down' : 'up';
          
          // Get document height and window height to detect boundaries
          const docHeight = Math.max(
            document.body.scrollHeight, 
            document.documentElement.scrollHeight
          );
          const windowHeight = window.innerHeight;
          const scrolledToBottom = currentScrollY + windowHeight >= docHeight - 10;
          const scrolledToTop = currentScrollY <= 10;
          
          // Minimum scroll threshold to trigger direction change (prevents bounces)
          const MIN_SCROLL_THRESHOLD = isIOS.current ? 10 : 5;
          const scrollDifference = Math.abs(currentScrollY - lastScrollY.current);
          
          // Check if we've scrolled enough to consider it a real scroll
          if (scrollDifference > MIN_SCROLL_THRESHOLD) {
            // Handle normal scroll behavior
            if (direction === 'down' && isVisible && !scrolledToTop) {
              setIsVisible(false);
            } else if (direction === 'up' && !isVisible && !scrolledToBottom) {
              setIsVisible(true);
            }
            
            // Special case: always show dock when at top scrolling down
            if (scrolledToTop && direction === 'down') {
              setIsVisible(true);
            }
            
            // Special case: always hide dock when at bottom scrolling up
            if (scrolledToBottom && direction === 'up') {
              setIsVisible(false);
            }
            
            lastDirection.current = direction;
          }
          
          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        
        ticking.current = true;
      }
    };
    
    // Add event listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    if (isIOS.current) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      
      if (isIOS.current) {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, [isVisible]);
  
  // Memoize the navItems array to prevent recreation on each render
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/", icon: Home, label: "Home" },
      { href: "/newsletters", icon: Mail, label: "Newsletters" },
      { href: "/podcasts", icon: Podcast, label: "Podcasts" },
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
    <>
      {/* Safe area background - this will be shown behind the dock */}
      <div className={cn("safe-area-bg", !isVisible && "hidden")} />
      
      {/* Main navigation bar */}
      <nav 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 content-center md:hidden",
          "bg-background backdrop-blur-md border-t border-border",
          "flex flex-col transition-transform duration-200 ease-in-out",
          isVisible ? "translate-y-0" : "translate-y-[200%]", // Use 200% to ensure it's completely off-screen
          className
        )}
        style={{ 
          height: "64px",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          marginBottom: "-1px" // This prevents a potential gap at the bottom
        }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around w-full pt-2">
          {navItems.map((item) => (
            <NavItem 
              key={item.href} 
              item={item} 
              isActive={checkIsActive(item.href)} 
            />
          ))}
        </div>
      </nav>
    </>
  );
});

