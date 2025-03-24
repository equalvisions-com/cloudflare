import { Metadata } from 'next';
import { ChatPage } from '../../components/chat/ChatPage';
import { StandardSidebarLayout } from '@/components/ui/StandardSidebarLayout';
import { LAYOUT_CONSTANTS } from '@/lib/layout-constants';
import { NotificationsWidgetServer } from '@/components/widgets/NotificationsWidgetServer';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with our AI assistant',
};

export default function Page() {
  return (
    <div className="fixed inset-0 md:static md:inset-auto w-full">
      <StandardSidebarLayout
        rightSidebar={
          <div className="flex flex-col gap-4">
            <NotificationsWidgetServer />
            
            <div className="p-4 rounded-lg border">
              <h2 className="text-lg font-semibold mb-4">Chat Information</h2>
              <p className="text-sm text-muted-foreground">
                Ask our AI assistant any questions about articles, products, or get general information.
              </p>
            </div>
          </div>
        }
        containerClass={LAYOUT_CONSTANTS.CONTAINER_CLASS}
        mainContentClass={LAYOUT_CONSTANTS.MAIN_CONTENT_CLASS}
        rightSidebarClass={LAYOUT_CONSTANTS.RIGHT_SIDEBAR_CLASS}
      >
        <ChatPage />
      </StandardSidebarLayout>
    </div>
  );
}
