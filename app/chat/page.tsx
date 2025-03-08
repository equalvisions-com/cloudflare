import { Metadata } from 'next';
import { ChatPage } from '../../components/chat/ChatPage';
import { StandardSidebarLayout } from '@/components/ui/StandardSidebarLayout';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with our AI assistant',
};

export default function Page() {
  return (
    <StandardSidebarLayout
      mainContentClass="flex-1 md:basis-[50%] md:max-w-[50%] overflow-hidden"
      rightSidebar={
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Chat Information</h2>
          <p className="text-sm text-muted-foreground">
            Ask our AI assistant any questions about articles, products, or get general information.
          </p>
        </div>
      }
    >
      <ChatPage />
    </StandardSidebarLayout>
  );
}
