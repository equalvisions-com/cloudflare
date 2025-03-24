import { TrendingWidget } from "@/components/trending/TrendingWidget";
import { SidebarSearch } from "@/components/search/SidebarSearch";
import { LegalWidget } from "@/components/widgets/LegalWidget";

interface RightSidebarProps {
  className?: string;
}

export function RightSidebar({ className = "" }: RightSidebarProps) {
  return (
    <div className="sticky top-6">
      <div className="flex flex-col gap-6">
        {/* Search Component */}
        <SidebarSearch />
        
        {/* Trending Widget */}
        <TrendingWidget />
        
        {/* Legal Widget */}
        <LegalWidget />
      </div>
    </div>
  );
}