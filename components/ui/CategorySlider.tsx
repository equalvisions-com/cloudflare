'use client';

import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { cn } from '@/lib/utils';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  mediaType: string;
  order?: number;
}

interface CategorySliderProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  className?: string;
}

export const CategorySlider = React.memo(({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className,
}: CategorySliderProps) => {
  // Find the index of the selected category.
  const selectedIndex = useMemo(() => 
    categories.findIndex(cat => cat._id === selectedCategoryId),
    [categories, selectedCategoryId]
  );
  
  // Initialize Embla carousel with options and the WheelGesturesPlugin.
  const carouselOptions = useMemo(() => ({
    align: 'start' as const,
    containScroll: 'keepSnaps' as const,
    dragFree: true, // Allow free-form dragging
    skipSnaps: false,
    duration: 10, // Longer duration for smoother animation
    inViewThreshold: 0.7, // Helps with smoother snapping
    slidesToScroll: 1
  }), []);

  const wheelPluginOptions = useMemo(() => ({
    wheelDraggingClass: '',
    forceWheelAxis: 'x' as const,
    wheelDuration: 50, // Smooth out wheel scrolling
    wheelSmoothness: 0.4 // Add some smoothness to wheel scrolling (0 to 1)
  }), []);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    carouselOptions,
    [WheelGesturesPlugin(wheelPluginOptions)]
  );

  // Prevent browser back/forward navigation when interacting with the slider
  useEffect(() => {
    if (!emblaApi) return;
    
    const viewportElement = emblaApi.rootNode();
    if (!viewportElement) return;
    
    // Prevent horizontal swipe navigation only when actually dragging
    const preventNavigation = (e: TouchEvent) => {
      if (!emblaApi.internalEngine().dragHandler.pointerDown()) return;
      
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      
      const handleTouchMove = (e: TouchEvent) => {
        if (!emblaApi.internalEngine().dragHandler.pointerDown()) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        
        // Only prevent default if horizontal movement is greater than vertical
        if (deltaX > deltaY) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      const cleanup = () => {
        document.removeEventListener('touchmove', handleTouchMove);
      };
      
      document.addEventListener('touchend', cleanup, { once: true });
      document.addEventListener('touchcancel', cleanup, { once: true });
    };
    
    // Prevent mousewheel horizontal navigation (for trackpads)
    const preventWheelNavigation = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && emblaApi.internalEngine().dragHandler.pointerDown()) {
        e.preventDefault();
      }
    };
    
    // Add event listeners with passive: false to allow preventDefault
    viewportElement.addEventListener('touchstart', preventNavigation, { passive: true });
    viewportElement.addEventListener('wheel', preventWheelNavigation, { passive: false });
    
    return () => {
      viewportElement.removeEventListener('touchstart', preventNavigation);
      viewportElement.removeEventListener('wheel', preventWheelNavigation);
    };
  }, [emblaApi]);

  // Keep track of button refs for scrolling to the selected button.
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scrolls to a specific category button only if it's not fully visible.
  const scrollToCategory = useCallback((index: number) => {
    if (!emblaApi) return;
    
    const selectedNode = buttonRefs.current[index];
    if (!selectedNode) return;
    
    const emblaViewport = emblaApi.rootNode();
    if (!emblaViewport) return;
    
    const containerRect = emblaViewport.getBoundingClientRect();
    const selectedRect = selectedNode.getBoundingClientRect();
    
    // If button is not fully visible, scroll to it
    if (
      selectedRect.right > containerRect.right ||
      selectedRect.left < containerRect.left
    ) {
      emblaApi.scrollTo(index);
    }
  }, [emblaApi]);

  // Define a stable overscroll prevention callback.
  const preventOverscroll = useCallback(() => {
    if (!emblaApi) return;
    const {
      limit,
      target,
      location,
      offsetLocation,
      scrollTo,
      translate,
      scrollBody,
    } = emblaApi.internalEngine();
    
    let edge: number | null = null;
    if (limit.reachedMax(target.get())) {
      edge = limit.max;
    } else if (limit.reachedMin(target.get())) {
      edge = limit.min;
    }
    
    if (edge !== null) {
      offsetLocation.set(edge);
      location.set(edge);
      target.set(edge);
      translate.to(edge);
      translate.toggleActive(false);
      scrollBody.useDuration(0).useFriction(0);
      scrollTo.distance(0, false);
    } else {
      translate.toggleActive(true);
    }
  }, [emblaApi]);

  // Bind overscroll prevention to scroll-related events.
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("scroll", preventOverscroll);
    emblaApi.on("settle", preventOverscroll);
    emblaApi.on("pointerUp", preventOverscroll);
    
    return () => {
      emblaApi.off("scroll", preventOverscroll);
      emblaApi.off("settle", preventOverscroll);
      emblaApi.off("pointerUp", preventOverscroll);
    };
  }, [emblaApi, preventOverscroll]);

  // When the selected category changes, scroll to it.
  useEffect(() => {
    if (emblaApi && selectedIndex !== -1) {
      scrollToCategory(selectedIndex);
    }
  }, [emblaApi, selectedIndex, scrollToCategory]);

  // Handle category selection.
  const handleCategoryClick = useCallback((categoryId: string) => {
    onSelectCategory(categoryId);
  }, [onSelectCategory]);

  return (
    <div className={cn("grid w-full overflow-hidden", className)}>
      <div className="overflow-hidden prevent-overscroll-navigation" ref={emblaRef}>
        <div className="flex mx-4 gap-6">
          {categories.map((category, index) => (
            <button
              key={category._id}
              ref={(el) => { buttonRefs.current[index] = el; }}
              className={cn(
                "flex-none pb-[12px] transition-all duration-50 whitespace-nowrap relative font-medium text-sm capitalize",
                "after:absolute after:bottom-0 after:left-0 after:w-full after:h-[.25rem] after:transition-all after:duration-200 after:rounded-full",
                category._id === selectedCategoryId
                  ? "text-primary after:bg-primary"
                  : "text-muted-foreground hover:text-foreground after:bg-background after:opacity-0"
              )}
              onClick={() => handleCategoryClick(category._id)}
              aria-selected={category._id === selectedCategoryId}
              role="tab"
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

CategorySlider.displayName = 'CategorySlider';
