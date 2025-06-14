"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

// Global scroll lock manager for drawers
let openDrawerCount = 0;
let lockedScrollY = 0;
let scrollbarWidth = 0;

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

const Drawer = React.memo(({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
  React.useEffect(() => {
    // Helper to clean up body styles and restore scroll position
    const cleanup = () => {
      openDrawerCount = Math.max(0, openDrawerCount - 1);
      if (openDrawerCount === 0) {
        const y = document.body.style.top ? -parseInt(document.body.style.top || '0', 10) : 0;
        
        // Smooth restoration to prevent flash
        document.body.style.transition = 'none';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.paddingRight = '';
        
        // Restore scroll position smoothly
        if (y) {
          requestAnimationFrame(() => {
            window.scrollTo(0, y);
          });
        }
      }
    };

    if (props.open) {
      if (openDrawerCount === 0) {
        // Calculate scrollbar width to prevent layout shift
        const scrollWidth = getScrollbarWidth();
        
        // Save scroll position and lock smoothly
        lockedScrollY = window.scrollY;
        
        // Apply styles in a way that prevents flash
        requestAnimationFrame(() => {
          document.body.style.transition = 'none';
          document.body.style.position = 'fixed';
          document.body.style.top = `-${lockedScrollY}px`;
          document.body.style.left = '0';
          document.body.style.right = '0';
          document.body.style.overflow = 'hidden';
          document.body.style.touchAction = 'none';
          // Compensate for scrollbar width to prevent layout shift
          document.body.style.paddingRight = `${scrollWidth}px`;
        });
      }
      openDrawerCount++;
    } else {
      cleanup();
    }
    return () => {
      cleanup();
    };
  }, [props.open]);

  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      disablePreventScroll={false} // Ensure scroll lock is enabled
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
