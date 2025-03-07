import { Card, CardContent } from "@/components/ui/card";
import { AboutCard } from "@/components/postpage/AboutCard";

interface RightSidebarProps {
  className?: string;
}

export function RightSidebar({ className = "" }: RightSidebarProps) {
  return (
    <div className="sticky top-6">
      <div className="flex flex-col mt-6">
        <Card className={`${className} h-fit shadow-none mt-4`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <AboutCard />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}