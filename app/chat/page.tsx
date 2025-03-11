import { Metadata } from 'next';
import { ChatPage } from '../../components/chat/ChatPage';
import { StandardSidebarLayout } from '@/components/ui/StandardSidebarLayout';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with our AI assistant',
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
};

export default function Page() {
  return (
    <StandardSidebarLayout
      rightSidebar={
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Chat Information</h2>
          <p className="text-sm text-muted-foreground">
            Ask our AI assistant any questions about articles, products, or get general information.
          </p>
        </div>
      }
      containerClass="overscroll-none"
      mainContentClass="overflow-visible"
    >
      <ChatPage />
    </StandardSidebarLayout>
  );
}
