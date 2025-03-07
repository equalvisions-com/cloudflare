'use client';

import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import useEmblaCarousel, { EmblaViewportRefType } from 'embla-carousel-react';
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
  emblaRef?: EmblaViewportRefType;
}

// Define the component first
function CategorySliderComponent({
  categories,
  selectedCategoryId,
  onSelectCategory,
  className,
  emblaRef,
}: CategorySliderProps) {
  // Find the index of the selected category.
  const selectedIndex = useMemo(() => 
    categories.findIndex(cat => cat._id === selectedCategoryId),
    [categories, selectedCategoryId]
  );
  
  // Only initialize local carousel if no external ref is provided
  const carouselOptions = useMemo(() => ({
    align: 'start' as const,
    containScroll: 'keepSnaps' as const,
    dragFree: true,
    skipSnaps: false,
    duration: 0, // Instant/fast scroll
  }), []);

  const wheelPluginOptions = useMemo(() => ({
    wheelDraggingClass: '',
    forceWheelAxis: 'x' as const,
  }), []);

  // Only create internal carousel if no external ref is provided
  const [internalEmblaRef, emblaApi] = useEmblaCarousel(
    emblaRef ? undefined : carouselOptions,
    emblaRef ? [] : [WheelGesturesPlugin(wheelPluginOptions)]
  );
  
  // Use the provided ref or our internal one
  const useEmblaRef = emblaRef || internalEmblaRef;

  // Keep track of button refs for scrolling to the selected button.
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scroll the selected button into view when the selected category changes.
  useEffect(() => {
    if (selectedIndex >= 0 && buttonRefs.current[selectedIndex]) {
      buttonRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedIndex]);

  // Scroll to the selected index when emblaApi is available
  useEffect(() => {
    if (emblaApi && selectedIndex !== -1) {
      emblaApi.scrollTo(selectedIndex);
    }
  }, [emblaApi, selectedIndex]);

  // Handle button click - select category
  const handleCategoryClick = useCallback((categoryId: string) => {
    onSelectCategory(categoryId);
  }, [onSelectCategory]);

  return (
    <div className={cn("grid w-full overflow-hidden", className)}>
      <div className="overflow-hidden" ref={useEmblaRef}>
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

// Export the memoized component with display name
export const CategorySlider = Object.assign(
  React.memo(CategorySliderComponent),
  { displayName: 'CategorySlider' }
);
