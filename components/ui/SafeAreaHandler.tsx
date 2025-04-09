"use client";

import { useEffect } from "react";

/**
 * SafeAreaHandler - A component specifically designed to handle safe area insets
 * in iOS Chrome where the browser has white bars on the bottom
 */
export function SafeAreaHandler() {
  useEffect(() => {
    // Check if we're on iOS Chrome
    const isIOSChrome = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                         /CriOS/.test(navigator.userAgent);
    
    if (isIOSChrome) {
      // Add specific styles to handle iOS Chrome's bottom bar
      const style = document.createElement('style');
      style.innerHTML = `
        html, body {
          height: 100% !important;
          overflow: auto !important;
          position: fixed !important;
          width: 100% !important;
          -webkit-overflow-scrolling: touch !important;
        }
        
        /* Override all safe area insets */
        html, body, div, main, section, article, nav, footer {
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
        }
        
        /* Ensure fixed position elements don't have bottom spacing */
        *[style*="position: fixed"], *[style*="position:fixed"], .fixed, [class*="fixed"] {
          bottom: 0 !important;
        }
      `;
      document.head.appendChild(style);
      
      // Add touch event listeners to recalculate height on touch
      document.addEventListener('touchstart', () => {
        document.body.style.height = `${window.innerHeight}px`;
      });
      
      document.addEventListener('touchmove', () => {
        document.body.style.height = `${window.innerHeight}px`;
      });
      
      document.addEventListener('touchend', () => {
        document.body.style.height = `${window.innerHeight}px`;
      });
    }
  }, []);
  
  return null; // Render nothing, just handle the effects
} 