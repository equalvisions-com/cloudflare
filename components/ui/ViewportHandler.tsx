"use client";

import { useEffect } from "react";

/**
 * ViewportHandler - A utility component that handles viewport height issues on mobile browsers
 * Especially targets iOS Chrome where toolbar appearance/disappearance affects viewport calculation
 */
export function ViewportHandler() {
  useEffect(() => {
    // Function to update viewport height variable
    const setViewportHeight = () => {
      // Set a small timeout to ensure we get the final height after any UI elements appear/disappear
      setTimeout(() => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
      }, 100);
    };

    // Initial call
    setViewportHeight();

    // Set up event listeners for various scenarios that might change viewport
    window.addEventListener("resize", setViewportHeight);
    window.addEventListener("orientationchange", setViewportHeight);
    window.addEventListener("scroll", setViewportHeight);
    window.addEventListener("touchmove", setViewportHeight);
    window.addEventListener("touchend", setViewportHeight);
    
    // iOS Safari specific event for when the toolbar hides/shows
    if (typeof window !== "undefined" && "visualViewport" in window) {
      window.visualViewport?.addEventListener("resize", setViewportHeight);
      window.visualViewport?.addEventListener("scroll", setViewportHeight);
    }

    return () => {
      // Clean up all event listeners
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      window.removeEventListener("scroll", setViewportHeight);
      window.removeEventListener("touchmove", setViewportHeight);
      window.removeEventListener("touchend", setViewportHeight);
      
      if (typeof window !== "undefined" && "visualViewport" in window) {
        window.visualViewport?.removeEventListener("resize", setViewportHeight);
        window.visualViewport?.removeEventListener("scroll", setViewportHeight);
      }
    };
  }, []);

  return null; // Render nothing, just handle the effects
} 