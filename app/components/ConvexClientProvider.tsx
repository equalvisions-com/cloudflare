import { useEffect } from "react";

export default function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  // Add useEffect to handle viewport height updates
  useEffect(() => {
    // Function to update CSS variable based on window height
    const updateVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    // Initial update
    updateVH();
    
    // Update on resize and orientation change
    window.addEventListener('resize', updateVH);
    window.addEventListener('orientationchange', updateVH);
    
    // Update on page load, iOS toolbar appearance/disappearance
    window.addEventListener('load', updateVH);
    window.addEventListener('scroll', updateVH);
    
    return () => {
      window.removeEventListener('resize', updateVH);
      window.removeEventListener('orientationchange', updateVH);
      window.removeEventListener('load', updateVH);
      window.removeEventListener('scroll', updateVH);
    };
  }, []);

  // ... existing code ...
} 