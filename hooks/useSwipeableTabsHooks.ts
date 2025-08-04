import { useEffect, useCallback, useRef, useState } from 'react';
import type { UseEmblaCarouselType } from 'embla-carousel-react';

// Type for Embla API
type EmblaCarouselType = UseEmblaCarouselType[1];

// Edge-safe timeout management
export const useEdgeSafeTimeouts = () => {
  const timeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  
  const createTimeout = useCallback((callback: () => void, delay: number): ReturnType<typeof setTimeout> => {
    const id = globalThis.setTimeout(callback, delay);
    timeouts.current.add(id);
    return id;
  }, []);
  
  const clearTimeoutSafe = useCallback((id: ReturnType<typeof setTimeout>) => {
    globalThis.clearTimeout(id);
    timeouts.current.delete(id);
  }, []);
  
  useEffect(() => {
    return () => {
      timeouts.current.forEach(id => globalThis.clearTimeout(id));
      timeouts.current.clear();
    };
  }, []);
  
  return { createTimeout, clearTimeoutSafe };
};

// Edge-safe mobile detection
export const useEdgeSafeMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    if (typeof globalThis.window === 'undefined') return;
    
    const checkMobile = () => {
      setIsMobile(globalThis.window.innerWidth < 768);
    };
    
    checkMobile();
    globalThis.window.addEventListener('resize', checkMobile);
    
    return () => {
      globalThis.window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  return isMobile;
};

// Embla setup hook
export const useEmblaSetup = (
  emblaApi: EmblaCarouselType | undefined, 
  defaultTabIndex: number,
  isMobile: boolean,
  onSelectedTabChange: (index: number) => void
) => {
  useEffect(() => {
    if (!emblaApi) return;
    
    emblaApi.scrollTo(defaultTabIndex, true);
    onSelectedTabChange(emblaApi.selectedScrollSnap());
  }, [emblaApi, defaultTabIndex, onSelectedTabChange]);

  useEffect(() => {
    if (!emblaApi) return;

    const viewportElement = emblaApi.rootNode();
    if (!viewportElement) return;

    viewportElement.style.touchAction = 'pan-y pinch-zoom';
    
    return () => {
      if (viewportElement) {
        viewportElement.style.touchAction = '';
      }
    };
  }, [emblaApi, isMobile]);
};

// Consolidated event handlers
export const useTabEventHandlers = (
  emblaApi: EmblaCarouselType | undefined,
  selectedTab: number,
  onTabChange: ((index: number) => void) | undefined,
  onSelectedTabChange: (index: number) => void,
  onTransitionStart: () => void,
  onTransitionEnd: () => void,
  onPointerDown: () => void,
  onSettle: () => void
) => {
  const lastTabChangeRef = useRef<{ index: number; time: number }>({ 
    index: selectedTab, 
    time: Date.now() 
  });
  const isInstantJumpRef = useRef(false);
  const isMountedRef = useRef(true);

  // Tab change with debouncing
  const handleTabChangeWithDebounce = useCallback((index: number) => {
    if (!isMountedRef.current) return;
    
    const now = Date.now();
    if (
      index === lastTabChangeRef.current.index || 
      (now - lastTabChangeRef.current.time < 300 && index !== selectedTab)
    ) {
      return;
    }
    
    lastTabChangeRef.current = { index, time: now };
    
    if (onTabChange) {
      onTabChange(index);
    }
  }, [onTabChange, selectedTab]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      if (!isMountedRef.current) return;
      
      const index = emblaApi.selectedScrollSnap();
      
      if (selectedTab !== index) {
        if (isInstantJumpRef.current) {
          isInstantJumpRef.current = false;
        }
        
        // Reset scroll position to top when tab changes (both click and swipe)
        if (typeof globalThis.window !== 'undefined') {
          globalThis.window.scrollTo(0, 0);
        }
        
        onSelectedTabChange(index);
        handleTabChangeWithDebounce(index);
      }
    };
    
    emblaApi.on('select', onSelect);
    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('settle', onSettle);
    emblaApi.on('settle', onTransitionEnd);
    emblaApi.on('select', onTransitionStart);
    
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('settle', onSettle);
      emblaApi.off('settle', onTransitionEnd);
      emblaApi.off('select', onTransitionStart);
    };
  }, [emblaApi, selectedTab, handleTabChangeWithDebounce, onPointerDown, onSettle, onTransitionEnd, onTransitionStart, onSelectedTabChange]);

  return { isInstantJumpRef };
};

// Edge-safe ResizeObserver
export const useEdgeSafeResizeObserver = (
  emblaApi: EmblaCarouselType | undefined,
  selectedTab: number,
  slideRefs: React.MutableRefObject<(HTMLDivElement | null)[]>,
  measureSlideHeights: () => void,
  onTransitionStart: () => void,
  onTransitionEnd: () => void
) => {
  const { createTimeout, clearTimeoutSafe } = useEdgeSafeTimeouts();
  const observerRef = useRef<ResizeObserver | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!emblaApi || typeof globalThis.ResizeObserver === 'undefined' || !isMountedRef.current) return;

    const activeSlideNode = slideRefs.current[selectedTab];
    if (!activeSlideNode) return;

    measureSlideHeights();
    
    emblaApi.on('settle', onTransitionEnd);
    emblaApi.on('select', onTransitionStart);

    const resizeObserver = new globalThis.ResizeObserver(() => {
      if (!isMountedRef.current) return;
      
      if (timeoutRef.current) clearTimeoutSafe(timeoutRef.current);
      
      timeoutRef.current = createTimeout(() => {
        globalThis.requestAnimationFrame(() => {
          if (!isMountedRef.current || !emblaApi) return;
          emblaApi.reInit();
        });
      }, 100);
    });

    resizeObserver.observe(activeSlideNode);
    observerRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      observerRef.current = null;
      if (timeoutRef.current) clearTimeoutSafe(timeoutRef.current);
      emblaApi.off('settle', onTransitionEnd);
      emblaApi.off('select', onTransitionStart);
    };
  }, [emblaApi, selectedTab, measureSlideHeights, onTransitionStart, onTransitionEnd, createTimeout, clearTimeoutSafe]);

  const disableObserver = useCallback(() => {
    if (!isMountedRef.current) return;
    observerRef.current?.disconnect();
  }, []);
  
  const enableObserver = useCallback(() => {
    if (!observerRef.current || typeof globalThis.window === 'undefined' || !isMountedRef.current) return;
    
    if (!emblaApi) return;

    const delayedTimeout = createTimeout(() => {
      if (!isMountedRef.current) return;
      
      const currentSelectedIndex = emblaApi.selectedScrollSnap();
      const activeSlideNode = slideRefs.current[currentSelectedIndex];

      if (activeSlideNode && observerRef.current) {
        observerRef.current.disconnect(); 
        observerRef.current.observe(activeSlideNode);
      }
    }, 250);

    return () => clearTimeoutSafe(delayedTimeout);
  }, [emblaApi, slideRefs, createTimeout, clearTimeoutSafe]);

  return { disableObserver, enableObserver };
}; 