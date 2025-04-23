'use client';

import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  mediaType: string;
  order?: number;
}

interface CategorySliderProps {
  categories: Category[] | undefined;
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  className?: string;
  isLoading?: boolean;
}

// Skeleton loader component for the CategorySlider
export const CategorySliderSkeleton = () => {
  return (
    <div className="grid w-full overflow-hidden">
      <div className="overflow-hidden">
        <div className="flex mx-4 gap-6 transform-gpu items-center mt-1 mb-[13px]">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-[15px] w-20 flex-none rounded-md"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Main component with proper hook usage
const CategorySliderComponent = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className,
  isLoading = false,
}: CategorySliderProps) => {
  // Find the index of the selected category.
  const selectedIndex = useMemo(() => 
    categories?.findIndex(cat => cat._id === selectedCategoryId) ?? -1,
    [categories, selectedCategoryId]
  );
  
  // Initialize Embla carousel with options and the WheelGesturesPlugin.
  const carouselOptions = useMemo(() => ({
    align: 'start' as const,
    containScroll: 'keepSnaps' as const,
    dragFree: true, // Allow free-form dragging
    skipSnaps: false,
    duration: 0, // Faster duration for smoother animation
    inViewThreshold: 0, // Helps with smoother snapping
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

  // Add indicator animation state
  const [isDragging, setIsDragging] = useState(false);
  
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

  // Handle category selection.
  const handleCategoryClick = useCallback((categoryId: string) => {
    onSelectCategory(categoryId);
  }, [onSelectCategory]);

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
    
    // Track dragging state
    const handlePointerDown = () => {
      setIsDragging(true);
    };
    
    const handlePointerUp = () => {
      setIsDragging(false);
    };
    
    // Add event listeners with passive: false to allow preventDefault
    viewportElement.addEventListener('touchstart', preventNavigation, { passive: true });
    viewportElement.addEventListener('wheel', preventWheelNavigation, { passive: false });
    emblaApi.on('pointerDown', handlePointerDown);
    emblaApi.on('pointerUp', handlePointerUp);
    emblaApi.on('settle', handlePointerUp);
    
    return () => {
      viewportElement.removeEventListener('touchstart', preventNavigation);
      viewportElement.removeEventListener('wheel', preventWheelNavigation);
      emblaApi.off('pointerDown', handlePointerDown);
      emblaApi.off('pointerUp', handlePointerUp);
      emblaApi.off('settle', handlePointerUp);
    };
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

  // If loading or categories are undefined, show skeleton
  if (isLoading || !categories) {
    return <CategorySliderSkeleton />;
  }

  return (
    <div className={cn("grid w-full overflow-hidden", className)}>
      <div 
        className="overflow-hidden prevent-overscroll-navigation" 
        ref={emblaRef}
        style={{
          willChange: 'transform',
          WebkitPerspective: '1000',
          WebkitBackfaceVisibility: 'hidden',
          touchAction: 'pan-y pinch-zoom'
        }}
      >
        <div 
          className="flex mx-4 gap-6 transform-gpu"
          style={{
            willChange: 'transform',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          {categories.map((category, index) => {
            const isSelected = category._id === selectedCategoryId;
            const isLastItem = index === categories.length - 1;
            
            return (
              <button
                key={category._id}
                ref={(el) => { buttonRefs.current[index] = el; }}
                className={cn(
                  "flex-none pb-[12px] transition-colors duration-50 whitespace-nowrap relative font-semibold text-sm capitalize transform-gpu",
                  isSelected
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => handleCategoryClick(category._id)}
                aria-selected={isSelected}
                role="tab"
                style={{
                  transform: 'translate3d(0,0,0)',
                  WebkitBackfaceVisibility: 'hidden',
                  ...(isLastItem ? { marginRight: '1rem' } : {})
                }}
              >
                {category.name}
                <div 
                  className={cn(
                    "absolute bottom-[0px] left-0 w-full h-[1px] rounded-full transition-opacity bg-primary z-50",
                    isSelected ? "opacity-100" : "opacity-0"
                  )}
                  style={{
                    transform: isSelected ? 'scaleX(1)' : 'scaleX(0.5)',
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease, opacity 0.2s ease'
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Properly memoize component with displayName
export const CategorySlider = React.memo(
  CategorySliderComponent, 
  (prevProps: CategorySliderProps, nextProps: CategorySliderProps): boolean => {
    // Handle cases where one or both categories arrays might be undefined
    const categoriesEqual = (): boolean => {
      // If both are undefined, they're equal
      if (!prevProps.categories && !nextProps.categories) return true;
      
      // If only one is undefined, they're not equal
      if (!prevProps.categories || !nextProps.categories) return false;
      
      // If lengths don't match, they're not equal
      if (prevProps.categories.length !== nextProps.categories.length) return false;
      
      // Compare each category by _id
      return prevProps.categories.every(
        (cat, i) => cat._id === nextProps.categories![i]._id
      );
    };

    return (
      prevProps.selectedCategoryId === nextProps.selectedCategoryId &&
      prevProps.isLoading === nextProps.isLoading &&
      categoriesEqual()
    );
  }
);

CategorySlider.displayName = 'CategorySlider';

// Default export for dynamic import
export default CategorySlider;
