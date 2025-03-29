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
  const lastScrollDirection = useRef<'up' | 'down'>('up');
  const ticking = useRef(false);
  
  // Handle scroll events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          // Determine scroll direction
          const direction = currentScrollY > lastScrollY.current ? 'down' : 'up';
          
          // Minimum scroll threshold to trigger direction change (prevents bounces)
          const MIN_SCROLL_THRESHOLD = 5;
          const scrollDifference = Math.abs(currentScrollY - lastScrollY.current);
          
          // Check if we've scrolled enough to consider it a real scroll
          if (scrollDifference > MIN_SCROLL_THRESHOLD) {
            // Only update visibility if direction has changed or matching our hide/show rules
            if (direction === 'down' && isVisible) {
              setIsVisible(false);
            } else if (direction === 'up' && !isVisible) {
              setIsVisible(true);
            }
            
            lastScrollDirection.current = direction;
          }
          
          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        
        ticking.current = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
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
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 content-center md:hidden",
        "bg-background/85 backdrop-blur-md border-t border-border",
        "flex flex-col transition-transform duration-200 ease-in-out",
        isVisible ? "translate-y-0" : "translate-y-full",
        className
      )}
      style={{ 
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
});

