import { Card, CardContent } from "@/components/ui/card";

interface RightSidebarProps {
  className?: string;
  children?: React.ReactNode;
}

export const RightSidebar = ({ className, children }: RightSidebarProps) => {
  return (
    <Card className={`${className} h-fit shadow-none mt-6`}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Related</h2>
          <div className="rounded-lg bg-accent/10 p-4 overflow-y-auto max-h-96">
            {children || (
              <p className="text-sm text-muted-foreground">
                Recent activity will appear here.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};