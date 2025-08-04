import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

interface MainContentProps {
  className?: string;
}

export const MainContent = ({ className }: MainContentProps) => {
  const cardData = useMemo(() => [...Array(12)], []);

  return (
    <Card className={`${className} border-0 shadow-none`}>
      <CardContent className="h-full p-0">
        <main className="custom-scrollbar h-full">
          <div className="grid grid-cols-1 gap-6 pl-0 p-6 md:grid-cols-2">
            {cardData.map((_, i) => (
              <Card key={i} className="overflow-hidden rounded-lg border bg-card shadow-sm">
                <div className="h-48 bg-muted" />
                <CardContent className="p-6">
                  <h3 className="mb-2 text-lg font-semibold">Card {i + 1}</h3>
                  <p className="text-sm text-muted-foreground">
                    This is a placeholder card with some sample content to demonstrate the grid layout and scrolling behavior.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </CardContent>
    </Card>
  );
};