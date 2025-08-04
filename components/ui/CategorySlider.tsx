'use client';

import React, { useCallback, useEffect, useRef, useMemo, useState, memo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { CategorySliderProps } from '@/lib/types';

// Skeleton loader component for the CategorySlider
export const CategorySliderSkeleton = memo(() => (
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
));

CategorySliderSkeleton.displayName = 'CategorySliderSkeleton';

// Custom hook for carousel logic
const useCarouselLogic = (
  categories: CategorySliderProps['categories'],
  selectedCategoryId: string,
  onSelectCategory: (categoryId: string) => void
) => {
  const [isDragging, setIsDragging] = useState(false);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Find the index of the selected category
  const selectedIndex = useMemo(() => 
    categories?.findIndex(cat => cat._id === selectedCategoryId) ?? -1,
    [categories, selectedCategoryId]
  );
  
  // Memoize carousel options
  const carouselOptions = useMemo(() => ({
    align: 'start' as const,
    containScroll: 'keepSnaps' as const,
    dragFree: true,
    skipSnaps: false,
    duration: 0,
    inViewThreshold: 0,
    slidesToScroll: 1
  }), []);

  const wheelPluginOptions = useMemo(() => ({
    wheelDraggingClass: '',
    forceWheelAxis: 'x' as const,
    wheelDuration: 50,
    wheelSmoothness: 0.4
  }), []);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    carouselOptions,
    [WheelGesturesPlugin(wheelPluginOptions)]
  );

  // Scroll to category function
  const scrollToCategory = useCallback((index: number) => {
    if (!emblaApi) return;
    
    const selectedNode = buttonRefs.current[index];
    if (!selectedNode) return;
    
    const emblaViewport = emblaApi.rootNode();
    if (!emblaViewport) return;
    
    const containerRect = emblaViewport.getBoundingClientRect();
    const selectedRect = selectedNode.getBoundingClientRect();
    
    if (
      selectedRect.right > containerRect.right ||
      selectedRect.left < containerRect.left
    ) {
      emblaApi.scrollTo(index);
    }
  }, [emblaApi]);

  // Prevent overscroll function
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

  // Handle category selection
  const handleCategoryClick = useCallback((categoryId: string) => {
    onSelectCategory(categoryId);
  }, [onSelectCategory]);

  return {
    emblaRef,
    emblaApi,
    selectedIndex,
    isDragging,
    setIsDragging,
    buttonRefs,
    scrollToCategory,
    preventOverscroll,
    handleCategoryClick,
  };
};

// Custom hook for carousel effects (reduced from multiple useEffects)
const useCarouselEffects = (
  emblaApi: ReturnType<typeof useEmblaCarousel>[1],
  selectedIndex: number,
  scrollToCategory: (index: number) => void,
  preventOverscroll: () => void,
  setIsDragging: (isDragging: boolean) => void
) => {
  // Combined effect for all carousel event listeners
  useEffect(() => {
    if (!emblaApi) return;
    
    const viewportElement = emblaApi.rootNode();
    if (!viewportElement) return;
    
    // Scroll to selected category when it changes
    if (selectedIndex >= 0) {
      scrollToCategory(selectedIndex);
    }

    // Event handlers
    const handlePointerDown = () => setIsDragging(true);
    const handlePointerUp = () => setIsDragging(false);
    
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
    
    const preventWheelNavigation = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && emblaApi.internalEngine().dragHandler.pointerDown()) {
        e.preventDefault();
      }
    };
    
    // Add all event listeners
    emblaApi.on('pointerDown', handlePointerDown);
    emblaApi.on('pointerUp', handlePointerUp);
    emblaApi.on('settle', handlePointerUp);
    emblaApi.on('scroll', preventOverscroll);
    
    viewportElement.addEventListener('touchstart', preventNavigation, { passive: true });
    viewportElement.addEventListener('wheel', preventWheelNavigation, { passive: false });

    // Cleanup function
    return () => {
      emblaApi.off('pointerDown', handlePointerDown);
      emblaApi.off('pointerUp', handlePointerUp);
      emblaApi.off('settle', handlePointerUp);
      emblaApi.off('scroll', preventOverscroll);
      
      viewportElement.removeEventListener('touchstart', preventNavigation);
      viewportElement.removeEventListener('wheel', preventWheelNavigation);
    };
  }, [emblaApi, selectedIndex, scrollToCategory, preventOverscroll, setIsDragging]);
    };

// Main component with modern React patterns
const CategorySliderComponent = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className,
  isLoading = false,
}: CategorySliderProps) => {
  const {
    emblaRef,
    emblaApi,
    selectedIndex,
    isDragging,
    setIsDragging,
    buttonRefs,
    scrollToCategory,
    preventOverscroll,
    handleCategoryClick,
  } = useCarouselLogic(categories, selectedCategoryId, onSelectCategory);

  // Use the combined effects hook
  useCarouselEffects(emblaApi, selectedIndex, scrollToCategory, preventOverscroll, setIsDragging);

  // Show skeleton while loading
  if (isLoading || !categories?.length) {
    return <CategorySliderSkeleton />;
  }

  return (
    <div className={cn("grid w-full overflow-hidden", className)}>
      <div className="overflow-hidden mr-4" ref={emblaRef}>
        <div className="flex mx-4 gap-6 transform-gpu items-center mt-1 mb-[13px]">
          {categories.map((category, index) => {
            const isSelected = category._id === selectedCategoryId;
            
            return (
              <button
                key={category._id}
                ref={(el) => { buttonRefs.current[index] = el; }}
                onClick={() => handleCategoryClick(category._id)}
                className={cn(
                  "flex-none text-sm font-medium transition-all duration-200 relative whitespace-nowrap",
                  "focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
                  "hover:text-foreground",
                  isSelected
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                style={{ outline: 'none' }}
                aria-pressed={isSelected}
                aria-label={`Select ${category.name} category`}
              >
                <span className="relative inline-flex">
                {category.name}
                </span>
                <span 
                  className={cn(
                    "absolute -bottom-[13px] left-0 w-full h-[1px] rounded-full transition-all duration-200",
                    isSelected && !isDragging 
                      ? "bg-primary opacity-100" 
                      : "opacity-0"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Export the memoized version
export const CategorySlider = memo(CategorySliderComponent);
      
// Export as default for dynamic imports
export default CategorySlider;
