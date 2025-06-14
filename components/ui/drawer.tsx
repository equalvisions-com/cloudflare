"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

// Global scroll lock manager for drawers
let openDrawerCount = 0;
let scrollbarWidth = 0;
let savedScrollPosition = 0;
let isKeyboardOpen = false;

// Calculate scrollbar width once and cache it
const getScrollbarWidth = () => {
  if (scrollbarWidth > 0) return scrollbarWidth;
  
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  // TypeScript fix for IE-specific property
  (outer.style as any).msOverflowStyle = 'scrollbar';
  document.body.appendChild(outer);
  
  const inner = document.createElement('div');
  outer.appendChild(inner);
  
  scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
  document.body.removeChild(outer);
  
  return scrollbarWidth;
};

// Mobile keyboard detection and scroll position management
const handleMobileKeyboard = () => {
  if (typeof window === 'undefined') return;
  
  const initialViewportHeight = window.innerHeight;
  let currentViewportHeight = initialViewportHeight;
  
  const handleViewportChange = () => {
    const newHeight = window.innerHeight;
    const heightDifference = Math.abs(newHeight - initialViewportHeight);
    
    // Keyboard is considered open if viewport shrinks by more than 150px
    const keyboardWasOpen = isKeyboardOpen;
    isKeyboardOpen = heightDifference > 150 && newHeight < initialViewportHeight;
    
    // If keyboard just opened, save current scroll position
    if (isKeyboardOpen && !keyboardWasOpen) {
      savedScrollPosition = window.scrollY;
    }
    
    // If keyboard just closed, restore scroll position
    if (!isKeyboardOpen && keyboardWasOpen) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollPosition);
      });
    }
    
    currentViewportHeight = newHeight;
  };
  
  // Listen for viewport changes
  window.addEventListener('resize', handleViewportChange);
  
  // Cleanup function
  return () => {
    window.removeEventListener('resize', handleViewportChange);
  };
};

const Drawer = React.memo(({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
  React.useEffect(() => {
    // Since Vaul already handles scroll prevention, we only need to handle
    // scrollbar width compensation to prevent layout shift
    const cleanup = () => {
      openDrawerCount = Math.max(0, openDrawerCount - 1);
      if (openDrawerCount === 0) {
        // Only reset the padding compensation
        document.body.style.paddingRight = '';
      }
    };

    if (props.open) {
      if (openDrawerCount === 0) {
        // Save initial scroll position when drawer opens
        savedScrollPosition = window.scrollY;
        
        // Calculate scrollbar width to prevent layout shift
        const scrollWidth = getScrollbarWidth();
        
        // Only apply scrollbar width compensation
        // Let Vaul handle the actual scroll prevention
        requestAnimationFrame(() => {
          document.body.style.paddingRight = `${scrollWidth}px`;
        });
        
        // Set up mobile keyboard handling
        const keyboardCleanup = handleMobileKeyboard();
        
        // Store cleanup function for later
        (cleanup as any).keyboardCleanup = keyboardCleanup;
      }
      openDrawerCount++;
    } else {
      // Clean up keyboard handling
      if ((cleanup as any).keyboardCleanup) {
        (cleanup as any).keyboardCleanup();
      }
      cleanup();
    }
    return () => {
      // Clean up keyboard handling
      if ((cleanup as any).keyboardCleanup) {
        (cleanup as any).keyboardCleanup();
      }
      cleanup();
    };
  }, [props.open]);

  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      disablePreventScroll={false} // Let Vaul handle scroll prevention
      repositionInputs={false} // Let browser handle input/keyboard
      {...props}
    />
  );
})
Drawer.displayName = "Drawer"

const DrawerTrigger = React.memo(DrawerPrimitive.Trigger)
DrawerTrigger.displayName = "DrawerTrigger"

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = React.memo(DrawerPrimitive.Close)
DrawerClose.displayName = "DrawerClose"

const DrawerOverlay = React.memo(React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
)))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.memo(React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-1 w-[40px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
)))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = React.memo(({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
))
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = React.memo(({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
))
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.memo(React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
)))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.memo(React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
)))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
