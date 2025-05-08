import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { SearchInput } from "@/components/ui/search-input";
import { PeopleSearchWrapper } from "@/components/users/PeopleSearchWrapper";

export const runtime = 'edge';

export const dynamic = 'force-dynamic';

export default function PeoplePage() {
  return (
    <StandardSidebarLayout
      rightSidebar={<RightSidebar showSearch={false} />}
    >
        <PeopleSearchWrapper />
    </StandardSidebarLayout>
  );
} 