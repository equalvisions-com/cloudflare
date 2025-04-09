"use client";

import { useEffect } from "react";

/**
 * ViewportHandler - A utility component that handles viewport height issues on mobile browsers
 * Especially targets iOS Chrome where toolbar appearance/disappearance affects viewport calculation
 */
export function ViewportHandler() {
  useEffect(() => {
    // Check if we're on iOS Chrome
    const isIOSChrome = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                         /CriOS/.test(navigator.userAgent);

    // Function to update viewport height variable
    const setViewportHeight = () => {
      // Set a small timeout to ensure we get the final height after any UI elements appear/disappear
      setTimeout(() => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
        
        // Force body to fill screen
        document.body.style.height = `${window.innerHeight}px`;
        
        // Handle iOS Chrome specifically with more aggressive fixes
        if (isIOSChrome) {
          document.documentElement.style.height = `${window.innerHeight}px`;
          
          // Override any safe area insets that might be causing the gap
          document.documentElement.style.paddingBottom = '0px';
          document.body.style.paddingBottom = '0px';
          
          // Apply position: fixed to body when in iOS Chrome
          document.body.style.position = 'fixed';
          document.body.style.width = '100%';
          document.body.style.overflowY = 'auto';
          // Use type assertion for non-standard webkit property
          (document.body.style as any)['-webkit-overflow-scrolling'] = 'touch';
        }
      }, 100);
    };

    // Initial call
    setViewportHeight();

    // Set up event listeners for various scenarios that might change viewport
    window.addEventListener("resize", setViewportHeight);
    window.addEventListener("orientationchange", setViewportHeight);
    
    // Add more aggressive event listeners for iOS Chrome
    if (isIOSChrome) {
      // Touch events to recalculate on every interaction
      document.addEventListener("touchstart", setViewportHeight, { passive: true });
      document.addEventListener("touchmove", setViewportHeight, { passive: true });
      document.addEventListener("touchend", setViewportHeight, { passive: true });
    } else {
      // Standard events for other browsers
      window.addEventListener("scroll", setViewportHeight);
    }
    
    // iOS Safari specific event for when the toolbar hides/shows
    if (typeof window !== "undefined" && "visualViewport" in window) {
      window.visualViewport?.addEventListener("resize", setViewportHeight);
      window.visualViewport?.addEventListener("scroll", setViewportHeight);
    }

    // Special handling for iOS Chrome which can have UI elements that collapse/expand
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // When tab becomes visible again, recalculate height
        setViewportHeight();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Clean up all event listeners
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      
      if (isIOSChrome) {
        document.removeEventListener("touchstart", setViewportHeight);
        document.removeEventListener("touchmove", setViewportHeight);
        document.removeEventListener("touchend", setViewportHeight);
      } else {
        window.removeEventListener("scroll", setViewportHeight);
      }
      
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      
      if (typeof window !== "undefined" && "visualViewport" in window) {
        window.visualViewport?.removeEventListener("resize", setViewportHeight);
        window.visualViewport?.removeEventListener("scroll", setViewportHeight);
      }
    };
  }, []);

  return null; // Render nothing, just handle the effects
} 