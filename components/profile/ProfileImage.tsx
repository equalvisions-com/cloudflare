"use client";

import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { User } from "lucide-react";

interface ProfileImageProps {
  profileImage?: string | null;
  username: string;
  size?: "sm" | "md" | "md-lg" | "lg" | "xl";
  className?: string;
}

export function ProfileImage({ 
  profileImage, 
  username, 
  size = "md", 
  className = "" 
}: ProfileImageProps) {
  // Size mappings
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-16 h-16",
    "md-lg": "w-14 h-14",
    lg: "w-24 h-24",
    xl: "w-32 h-32"
  };

  const iconSizes = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    "md-lg": "h-7 w-7",
    lg: "h-14 w-14",
    xl: "h-16 w-16"
  };

  const sizeClass = sizeClasses[size];
  const iconSize = iconSizes[size];
  
  // If no profile image is provided, show a fallback
  if (!profileImage) {
    return (
      <div className={`${sizeClass} bg-muted flex items-center justify-center rounded-lg overflow-hidden border border-border ${className}`}>
        <User className={iconSize} />
      </div>
    );
  }

  // With profile image
  return (
    <div className={`${sizeClass} relative rounded-lg overflow-hidden border border-border ${className}`}>
      <AspectRatio ratio={1} className="h-full">
        <Image
          src={profileImage}
          alt={`${username}'s profile picture`}
          fill
          className="object-cover"
          sizes={`(max-width: 768px) ${parseInt(sizeClass.split("w-")[1]) * 4}px, ${parseInt(sizeClass.split("w-")[1]) * 4}px`}
          loading="lazy"
          priority={false}
        />
      </AspectRatio>
    </div>
  );
} 