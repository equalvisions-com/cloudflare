"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  href?: string;
  className?: string;
}

export function BackButton({ href = "/", className }: BackButtonProps) {
  return (
    <Link 
      href={href} 
      className={cn(
        "inline-flex items-center justify-center rounded-full p-2 text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none", 
        className
      )}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
    </Link>
  );
} 