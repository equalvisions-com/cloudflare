import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { SearchInput } from "@/components/ui/search-input";
import { PeopleSearchWrapper } from "@/components/users/PeopleSearchWrapper";

export default function PeoplePage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar showSearch={false} />}
    >
        <div className="sm:pb-[119px] md:pb-[56px]">
        <PeopleSearchWrapper />
        </div>
    </StandardSidebarLayout>
  );
} 