import { StandardSidebarLayout } from "@/components/ui/StandardSidebarLayout";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { SearchInput } from "@/components/ui/search-input";
import { PeopleSearchWrapper } from "@/components/users/PeopleSearchWrapper";
import { AiButton } from "@/app/components/ui/ai-button";
import { Suspense } from "react";

export default function PeoplePage() {
  return (
    <>
      <StandardSidebarLayout
        rightSidebar={<RightSidebar showSearch={false} />}
      >
          <PeopleSearchWrapper />
      </StandardSidebarLayout>
      <Suspense fallback={null}>
        <AiButton />
      </Suspense>
    </>
  );
} 