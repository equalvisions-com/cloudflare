'use client';

import React, { useCallback, useEffect, useRef } from 'react';
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

export function CategorySlider({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className,
}: CategorySliderProps) {
  // Find the index of the selected category.
  const selectedIndex = categories.findIndex(cat => cat._id === selectedCategoryId);
  
  // Initialize Embla carousel with options and the WheelGesturesPlugin.
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: 'start',
      containScroll: 'keepSnaps',
      dragFree: true,
      skipSnaps: false,
      duration: 0, // Instant/fast scroll
    },
    [WheelGesturesPlugin({
      wheelDraggingClass: '',
      forceWheelAxis: 'x',
    })]
  );

  // Keep track of button refs for scrolling to the selected button.
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scrolls to a specific category button only if it's not visible at all.
  const scrollToCategory = useCallback((index: number) => {
    if (!emblaApi) return;
    
    // For the first category, scroll to beginning.
    if (index === 0) {
      emblaApi.scrollTo(0, true);
      return;
    }
    
    const selectedNode = buttonRefs.current[index];
    if (!selectedNode) return;
    
    const emblaViewport = emblaApi.rootNode();
    if (!emblaViewport) return;
    
    const containerRect = emblaViewport.getBoundingClientRect();
    const selectedRect = selectedNode.getBoundingClientRect();
    
    // If any part of the button is visible, do nothing.
    if (
      selectedRect.right > containerRect.left &&
      selectedRect.left < containerRect.right
    ) {
      return;
    }
    
    // Otherwise, scroll instantly to bring the category into view.
    emblaApi.scrollTo(index, true);
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

  // When the selected category changes, scroll to it if necessary.
  useEffect(() => {
    if (emblaApi && selectedIndex !== -1) {
      scrollToCategory(selectedIndex);
      const timeout = setTimeout(() => {
        preventOverscroll();
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [emblaApi, selectedIndex, scrollToCategory, preventOverscroll]);

  // Handle category selection.
  const handleCategoryClick = useCallback((categoryId: string) => {
    onSelectCategory(categoryId);
  }, [onSelectCategory]);

  return (
    <div className={cn("grid w-full overflow-hidden", className)}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex mx-4 gap-6">
          {categories.map((category, index) => (
            <button
              key={category._id}
              ref={(el) => { buttonRefs.current[index] = el; }}
              className={cn(
                "flex-none pb-[12px] transition-all duration-200 whitespace-nowrap relative font-medium text-sm",
                "after:absolute after:bottom-0 after:left-0 after:w-full after:h-[.25rem] after:transition-all after:duration-200 after:rounded-full",
                category._id === selectedCategoryId
                  ? "text-primary after:bg-primary after:opacity-100"
                  : "text-muted-foreground hover:text-foreground after:opacity-0"
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
}
