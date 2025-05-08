"use client";

import Image from "next/image";
import "../../lib/edge-polyfills";

interface UserMenuImageProps {
  src: string;
  alt: string;
}

/**
 * Isolated component that uses Next Image
 * This allows us to dynamically load only this part
 */
export default function UserMenuImage({ src, alt }: UserMenuImageProps) {
  return (
    <div className="h-9 w-9 overflow-hidden rounded-full">
      <Image 
        src={src} 
        alt={alt} 
        width={36}
        height={36}
        className="h-full w-full object-cover"
      />
    </div>
  );
} 