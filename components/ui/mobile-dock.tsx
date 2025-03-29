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
  const scrollDirection = useRef<'up' | 'down' | null>(null);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const confirmationCount = useRef(0);
  
  // Scroll direction detection with improved handling for momentum scrolling
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Always show dock when at the top of the page
      if (currentScrollY <= 5) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }
      
      // Determine current scroll direction
      const currentDirection = currentScrollY < lastScrollY.current ? 'up' : 'down';
      
      // If direction is same as previous, increment the confirmation counter
      if (currentDirection === scrollDirection.current) {
        confirmationCount.current++;
      } else {
        // Direction changed, reset counter and update direction
        confirmationCount.current = 1;
        scrollDirection.current = currentDirection;
      }
      
      // Only process significant scroll changes to avoid micromovements
      if (Math.abs(currentScrollY - lastScrollY.current) >= 10) {
        // Require multiple confirmations for direction change
        if (confirmationCount.current >= 2) {
          if (currentDirection === 'up') {
            setIsVisible(true);
          } else {
            setIsVisible(false);
          }
        }
        
        // Update scroll position
        lastScrollY.current = currentScrollY;
      }
      
      // Clear any existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      
      // Set a timeout to handle the end of scroll events (including momentum scrolling)
      scrollTimeout.current = setTimeout(() => {
        // When at the bottom of the page and scroll momentum ends, keep the dock hidden
        const isAtBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 10;
        if (isAtBottom && currentDirection === 'down') {
          setIsVisible(false);
        }
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);
  
  // Show the dock when the route changes
  useEffect(() => {
    setIsVisible(true);
  }, [pathname]);
  
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
        "flex flex-col transition-transform duration-150",
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

