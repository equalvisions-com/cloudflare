import { Metadata } from 'next';
import { ChatPage } from '../../components/chat/ChatPage';
import { StandardSidebarLayout } from '@/components/ui/StandardSidebarLayout';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with our AI assistant',
};

export default function Page() {
  return (
    <div className="fixed inset-0 md:static md:inset-auto md:overflow-auto">
      <StandardSidebarLayout
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
    </div>
  );
}
