"use client";

import { useEffect, useState } from "react";
import { getBrowserInfo } from "@/lib/getBrowserInfo";

export function ViewportFix() {
  const [browser, setBrowser] = useState({ isIOS: false, isSafari: false, isChromeIOS: false });

  useEffect(() => {
    setBrowser(getBrowserInfo());
  }, []);

  useEffect(() => {
    // Get the body element
    const body = document.body;
    
    // Add or remove classes based on browser detection
    if (browser.isChromeIOS) {
      body.classList.remove("h-screen");
      body.classList.add("h-svh");
    } else {
      body.classList.remove("h-svh");
      body.classList.add("h-screen");
    }
    
    // Cleanup function to avoid memory leaks
    return () => {
      body.classList.remove("h-svh", "h-screen");
    };
  }, [browser]);

  return null;
} 