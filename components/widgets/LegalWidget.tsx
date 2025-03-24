"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface LegalWidgetProps {
  className?: string;
}

export function LegalWidget({ className = "" }: LegalWidgetProps) {
  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardContent className="px-4 py-4 rounded">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
          <Link href="/privacy" className="hover:underline hover:text-foreground transition-colors">
              Submit
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:underline hover:text-foreground transition-colors">
              Advertise
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:underline hover:text-foreground transition-colors">
              Privacy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:underline hover:text-foreground transition-colors">
              Terms
            </Link>
        
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 