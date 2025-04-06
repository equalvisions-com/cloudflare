"use client";

import { useEffect } from "react";

export function ViewportFix() {
  useEffect(() => {
    // Function to set the viewport height
    const setViewportHeight = () => {
      // Get the actual viewport height
      const vh = window.innerHeight * 0.01;
      // Set the value in CSS custom property --vh
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    // Set the height initially
    setViewportHeight();

    // Update the height on resize and orientation change
    window.addEventListener("resize", setViewportHeight);
    window.addEventListener("orientationchange", setViewportHeight);

    // Optional: update on scroll, as some mobile browsers hide/show UI elements on scroll
    window.addEventListener("scroll", setViewportHeight);

    // Clean up
    return () => {
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      window.removeEventListener("scroll", setViewportHeight);
    };
  }, []);

  return null; // This is a utility component with no UI
} 