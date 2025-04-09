"use client";

import { useEffect } from "react";

/**
 * ViewportHandler - A utility component that handles viewport height issues on mobile browsers
 * Especially targets iOS Chrome where toolbar appearance/disappearance affects viewport calculation
 */
export function ViewportHandler() {
  useEffect(() => {
    // Check if this is iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isChrome = /CriOS/.test(navigator.userAgent);
    
    // Function to update viewport height variable
    const setViewportHeight = () => {
      if (isIOS) {
        // iOS needs special handling
        const windowHeight = window.innerHeight;
        const visualHeight = window.visualViewport ? window.visualViewport.height : windowHeight;
        const height = Math.min(windowHeight, visualHeight); 
        const vh = height * 0.01;
        
        document.documentElement.style.setProperty("--vh", `${vh}px`);
        
        // For iOS Chrome specifically
        if (isChrome) {
          // Ensure the body fills the available space
          document.documentElement.style.height = `${height}px`;
          document.body.style.height = `${height}px`;
        }
      } else {
        // Standard approach for other browsers
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
      }
    };
    
    // iOS Chrome tends to have issues with scroll position after resize
    const resetScroll = () => {
      if (isIOS && isChrome) {
        // Force the page to scroll to top and then back to where it was
        const scrollY = window.scrollY;
        window.scrollTo(0, 0);
        setTimeout(() => window.scrollTo(0, scrollY), 50);
      }
    };

    // Initial call
    setViewportHeight();
    
    // Set up event listeners
    window.addEventListener("resize", setViewportHeight);
    window.addEventListener("orientationchange", () => {
      setViewportHeight();
      // On orientation change, need to wait for UI to settle
      setTimeout(setViewportHeight, 100);
      setTimeout(setViewportHeight, 500);
    });
    
    if (isIOS) {
      // iOS specific handlers
      window.addEventListener("scroll", setViewportHeight);
      window.addEventListener("touchmove", setViewportHeight);
      window.addEventListener("touchend", setViewportHeight);
      
      // iOS Chrome often needs some time after events to settle
      if (isChrome) {
        window.addEventListener("scroll", resetScroll, { passive: true });
        // Set height multiple times to account for delayed toolbar animations
        setInterval(setViewportHeight, 500);
      }
    }
    
    // Visual Viewport API (modern solution)
    if (typeof window !== "undefined" && "visualViewport" in window) {
      window.visualViewport?.addEventListener("resize", setViewportHeight);
      window.visualViewport?.addEventListener("scroll", setViewportHeight);
    }

    return () => {
      // Clean up event listeners
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      
      if (isIOS) {
        window.removeEventListener("scroll", setViewportHeight);
        window.removeEventListener("touchmove", setViewportHeight);
        window.removeEventListener("touchend", setViewportHeight);
        
        if (isChrome) {
          window.removeEventListener("scroll", resetScroll);
        }
      }
      
      if (typeof window !== "undefined" && "visualViewport" in window) {
        window.visualViewport?.removeEventListener("resize", setViewportHeight);
        window.visualViewport?.removeEventListener("scroll", setViewportHeight);
      }
    };
  }, []);

  return null;
} 