"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface LegalWidgetProps {
  className?: string;
}

export function LegalWidget({ className = "" }: LegalWidgetProps) {
  return (
    <Card className={`shadow-none ${className}`}>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Link href="/privacy" className="hover:underline hover:text-foreground transition-colors">
              Privacy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:underline hover:text-foreground transition-colors">
              Terms
            </Link>
            <span>•</span>
            <Link href="/help" className="hover:underline hover:text-foreground transition-colors">
              Help
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 