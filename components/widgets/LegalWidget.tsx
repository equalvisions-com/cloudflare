import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { memo } from "react";
import type { LegalWidgetProps } from "@/lib/types";
import { SubmissionDialog } from "@/components/ui/submission-dialog";

export const LegalWidget = memo<LegalWidgetProps>(({ className = "" }) => {
  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardContent className="px-4 py-4 rounded">
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1 leading-none">
            <SubmissionDialog>
              <button className="hover:underline hover:text-foreground transition-colors">
                Submit
              </button>
            </SubmissionDialog>
            <span>•</span>
            <Link href="#" className="hover:underline hover:text-foreground transition-colors" prefetch={false}>
              Privacy
            </Link>
            <span>•</span>
            <Link href="#" className="hover:underline hover:text-foreground transition-colors" prefetch={false}>
              Terms
            </Link>
            <span>•</span>
            <Link href="#" className="hover:underline hover:text-foreground transition-colors" prefetch={false}>
              Help
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

LegalWidget.displayName = 'LegalWidget'; 