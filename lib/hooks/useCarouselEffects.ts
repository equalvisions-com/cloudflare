import { useEffect, useCallback, useRef } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';
import { Category, CategorySwipeableState, TabHeights } from '@/lib/types';

interface UseCarouselEffectsProps {
  emblaApi: EmblaCarouselType | undefined;
  searchEmblaApi: EmblaCarouselType | undefined;
  state: CategorySwipeableState;
  allCategories: Category[];
  slideRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  searchSlideRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  tabHeightsRef: React.MutableRefObject<TabHeights>;
  scrollPositionsRef: React.MutableRefObject<Record<string, number>>;
  isRestoringScrollRef: React.MutableRefObject<boolean>;
  isInstantJumpRef: React.MutableRefObject<boolean>;
  observerRef: React.MutableRefObject<ResizeObserver | null>;
  updateState: (updates: Partial<CategorySwipeableState>) => void;
  restoreScrollPosition: (categoryId: string) => void;
}

export const useCarouselEffects = ({
  emblaApi,
  searchEmblaApi,
  state,
  allCategories,
  slideRefs,
  searchSlideRefs,
  tabHeightsRef,
  scrollPositionsRef,
  isRestoringScrollRef,
  isInstantJumpRef,
  observerRef,
  updateState,
  restoreScrollPosition,
}: UseCarouselEffectsProps) => {
  
  // Measure slide heights
  const measureSlideHeights = useCallback(() => {
    slideRefs.current.forEach((slide, index) => {
      if (slide && slide.offsetHeight > 0) {
        tabHeightsRef.current[allCategories[index]._id] = slide.offsetHeight;
      }
    });
  }, [allCategories, slideRefs, tabHeightsRef]);

  // ResizeObserver setup for main carousel
  useEffect(() => {
    if (!emblaApi || typeof window === 'undefined' || !allCategories.length) return;

    const categoryIndex = allCategories.findIndex(cat => cat._id === state.selectedCategoryId);
    if (categoryIndex === -1) return;
    
    const activeSlideNode = slideRefs.current[categoryIndex];
    if (!activeSlideNode) return;

    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let isInTransition = false;
    let delayedReInitTimeout: ReturnType<typeof setTimeout> | null = null;
    
    measureSlideHeights();
    
    const onTransitionStart = () => {
      isInTransition = true;
      
      const emblaContainer = emblaApi.containerNode();
      const selectedIndex = emblaApi.selectedScrollSnap();
      const selectedCategory = allCategories[selectedIndex];
      const targetHeight = selectedCategory ? tabHeightsRef.current[selectedCategory._id] : undefined;
      
      if (emblaContainer && targetHeight) {
        emblaContainer.style.height = `${targetHeight}px`;
        emblaContainer.style.transition = 'none';
      }
      
      if (delayedReInitTimeout) {
        clearTimeout(delayedReInitTimeout);
        delayedReInitTimeout = null;
      }
    };
    
    const onTransitionEnd = () => {
      isInTransition = false;
      
      const emblaContainer = emblaApi.containerNode();
      if (emblaContainer) {
        setTimeout(() => {
          if (!emblaContainer) return;
          
          emblaContainer.style.transition = 'height 200ms ease-out';
          
          const selectedIndex = emblaApi.selectedScrollSnap();
          const selectedCategory = allCategories[selectedIndex];
          const targetHeight = selectedCategory ? tabHeightsRef.current[selectedCategory._id] : undefined;
          
          if (targetHeight) {
            emblaContainer.style.height = `${targetHeight}px`;
            
            setTimeout(() => {
              if (!emblaContainer) return;
              
              emblaContainer.style.height = '';
              emblaContainer.style.transition = '';
              emblaApi.reInit();
              measureSlideHeights();
            }, 200);
          } else {
            emblaContainer.style.height = '';
            emblaContainer.style.transition = '';
            emblaApi.reInit();
            measureSlideHeights();
          }
        }, 50);
      }
    };
    
    emblaApi.on('settle', onTransitionEnd);
    emblaApi.on('select', onTransitionStart);

    const resizeObserver = new ResizeObserver(() => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        window.requestAnimationFrame(() => {
          if (!emblaApi) return;
          
          if (isInTransition) {
            if (delayedReInitTimeout) {
              clearTimeout(delayedReInitTimeout);
            }
            delayedReInitTimeout = setTimeout(() => {
              if (!emblaApi) return;
              emblaApi.reInit();
            }, 300);
          } else {
            emblaApi.reInit();
          }
        });
      }, 250);
    });

    resizeObserver.observe(activeSlideNode);
    observerRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      observerRef.current = null;
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (delayedReInitTimeout) clearTimeout(delayedReInitTimeout);
      emblaApi.off('settle', onTransitionEnd);
      emblaApi.off('select', onTransitionStart);
    };
  }, [emblaApi, state.selectedCategoryId, allCategories, measureSlideHeights, slideRefs, tabHeightsRef, observerRef]);

  // Observer pause/resume during interaction
  useEffect(() => {
    if (!emblaApi || !observerRef.current) return;

    const disableObserver = () => {
      observerRef.current?.disconnect();
    };

    const enableObserver = () => {
      if (!emblaApi || !observerRef.current || typeof window === 'undefined') return;

      setTimeout(() => {
        if (!emblaApi || !observerRef.current) return;
        
        const currentSelectedIndex = emblaApi.selectedScrollSnap();
        const activeSlideNode = slideRefs.current[currentSelectedIndex];

        if (activeSlideNode && observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current.observe(activeSlideNode);
        }
      }, 250);
    };

    emblaApi.on('pointerDown', disableObserver);
    emblaApi.on('pointerUp', enableObserver);
    emblaApi.on('settle', enableObserver);

    return () => {
      emblaApi.off('pointerDown', disableObserver);
      emblaApi.off('pointerUp', enableObserver);
      emblaApi.off('settle', enableObserver);
    };
  }, [emblaApi, observerRef, slideRefs]);

  // Sync category selection with carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      if (index >= 0 && index < allCategories.length) {
        const selectedCategory = allCategories[index];
        
        if (selectedCategory._id !== state.selectedCategoryId) {
          if (!isInstantJumpRef.current && !isRestoringScrollRef.current) {
            scrollPositionsRef.current[state.selectedCategoryId] = window.scrollY;
          }

          restoreScrollPosition(selectedCategory._id);

          if (isInstantJumpRef.current) {
            isInstantJumpRef.current = false;
          }
          
          updateState({ selectedCategoryId: selectedCategory._id });
        }
      }
    };
    
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, state.selectedCategoryId, allCategories, restoreScrollPosition, updateState, scrollPositionsRef, isInstantJumpRef, isRestoringScrollRef]);

  // Track interaction state
  useEffect(() => {
    if (!emblaApi) return;

    const handlePointerDown = () => {
      updateState({ isInteracting: true });
    };

    const handleSettle = () => {
      updateState({ isInteracting: false });
    };

    emblaApi.on('pointerDown', handlePointerDown);
    emblaApi.on('settle', handleSettle);

    return () => {
      emblaApi.off('pointerDown', handlePointerDown);
      emblaApi.off('settle', handleSettle);
    };
  }, [emblaApi, updateState]);

  // Transition state handling
  useEffect(() => {
    if (!emblaApi) return;

    const handleTransitionStart = () => {
      updateState({ isTransitioning: true });
    };

    const handleTransitionEnd = () => {
      setTimeout(() => {
        updateState({ isTransitioning: false });
      }, 50);
    };

    emblaApi.on('settle', handleTransitionEnd);
    emblaApi.on('select', handleTransitionStart);

    return () => {
      emblaApi.off('settle', handleTransitionEnd);
      emblaApi.off('select', handleTransitionStart);
    };
  }, [emblaApi, updateState]);

  // Search carousel sync
  useEffect(() => {
    if (!searchEmblaApi) return;
    
    const onSelect = () => {
      try {
        const index = searchEmblaApi.selectedScrollSnap();
        if (index === undefined) return;
        
        const newTab = index === 0 ? 'posts' : 'entries';
        
        if (newTab !== state.searchTab) {
          scrollPositionsRef.current[`search-${state.searchTab}`] = window.scrollY;
          restoreScrollPosition(`search-${newTab}`);
          updateState({ searchTab: newTab });
        }
      } catch (error) {
  
      }
    };
    
    searchEmblaApi.on('select', onSelect);
    
    return () => {
      searchEmblaApi.off('select', onSelect);
    };
  }, [searchEmblaApi, state.searchTab, restoreScrollPosition, updateState, scrollPositionsRef]);

  // Search slides observer
  useEffect(() => {
    if (!searchEmblaApi || typeof window === 'undefined') return;

    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleResize = () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        window.requestAnimationFrame(() => {
          if (!searchEmblaApi) return;
          searchEmblaApi.reInit();
        });
      }, 250);
    };

    const searchResizeObserver = new ResizeObserver(handleResize);

    searchSlideRefs.current.forEach(slide => {
      if (slide) {
        searchResizeObserver.observe(slide);
      }
    });

    return () => {
      searchResizeObserver.disconnect();
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, [searchEmblaApi, searchSlideRefs]);

  // Content stability during transitions
  useEffect(() => {
    const handleTransitionComplete = () => {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    };
    
    if (emblaApi) {
      emblaApi.on('settle', handleTransitionComplete);
    }
    
    if (searchEmblaApi) {
      searchEmblaApi.on('settle', handleTransitionComplete);
    }
    
    return () => {
      if (emblaApi) {
        emblaApi.off('settle', handleTransitionComplete);
      }
      
      if (searchEmblaApi) {
        searchEmblaApi.off('settle', handleTransitionComplete);
      }
    };
  }, [emblaApi, searchEmblaApi]);

  // Initialize components and measure heights
  useEffect(() => {
    const initializeComponents = () => {
      if (state.searchQuery) {
        if (searchSlideRefs.current[0]) {
          tabHeightsRef.current['search-posts'] = searchSlideRefs.current[0].offsetHeight || 
                                                 tabHeightsRef.current['search-posts'] || 300;
        }
        
        if (searchSlideRefs.current[1]) {
          tabHeightsRef.current['search-entries'] = searchSlideRefs.current[1].offsetHeight || 
                                                  tabHeightsRef.current['search-entries'] || 300;
        }
        
        if (searchEmblaApi) {
          setTimeout(() => {
            if (searchEmblaApi) {
              searchEmblaApi.reInit();
            }
          }, 50);
        }
      } else {
        slideRefs.current.forEach((slide, index) => {
          if (slide && slide.offsetHeight > 0 && index < allCategories.length) {
            tabHeightsRef.current[allCategories[index]._id] = slide.offsetHeight || 
                                                           tabHeightsRef.current[allCategories[index]._id] || 300;
          }
        });
        
        if (emblaApi) {
          setTimeout(() => {
            if (emblaApi) {
              emblaApi.reInit();
            }
          }, 50);
        }
      }
    };
    
    initializeComponents();
    window.addEventListener('resize', initializeComponents);
    
    return () => {
      window.removeEventListener('resize', initializeComponents);
    };
  }, [emblaApi, searchEmblaApi, state.searchQuery, allCategories, state.searchTab, slideRefs, searchSlideRefs, tabHeightsRef]);

  // Handle search carousel reinitialization only
  useEffect(() => {
    if (searchEmblaApi && state.searchQuery) {
      // Only reinitialize the search carousel, don't manage searchContentLoaded
      const timer = setTimeout(() => {
        searchEmblaApi.reInit();
      }, 100); // Reduced delay
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [state.searchQuery, searchEmblaApi]);

  // DOM mutation observer for search content
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    
    const observers: MutationObserver[] = [];
    
    const handleMutation = () => {
      searchSlideRefs.current.forEach((slide, index) => {
        if (slide && slide.offsetHeight > 0) {
          const key = index === 0 ? 'search-posts' : 'search-entries';
          tabHeightsRef.current[key] = slide.offsetHeight;
        }
      });
      
      if (searchEmblaApi) {
        setTimeout(() => {
          if (searchEmblaApi) {
            searchEmblaApi.reInit();
          }
        }, 50);
      }
    };
    
    searchSlideRefs.current.forEach((slide) => {
      if (slide) {
        const observer = new MutationObserver(handleMutation);
        observer.observe(slide, { 
          childList: true, 
          subtree: true,
          attributes: true
        });
        observers.push(observer);
      }
    });
    
    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [state.searchContentLoaded, searchEmblaApi, searchSlideRefs, tabHeightsRef]);
}; 