"use client";

import Image from "next/image";
import type { UserMenuImageProps } from "@/lib/types";
import { memo } from "react";

/**
 * Optimized user menu image component for Edge runtime
 * Uses Next.js 14+ Image optimizations with minimal overhead
 * Memoized for high concurrent user performance
 * Priority loading prevents navigation flicker
 */
const UserMenuImage = memo(function UserMenuImage({ src, alt }: UserMenuImageProps) {
  return (
    <div className="h-9 w-9 overflow-hidden rounded-full">
      <Image 
        key={`profile-${src}`}
        src={src} 
        alt={alt} 
        width={36}
        height={36}
        className="h-full w-full object-cover"
        priority={true}
        sizes="36px"
        quality={80}
        unoptimized={false}
      />
    </div>
  );
});

export default UserMenuImage; 