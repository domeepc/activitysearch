import type { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  
  try {
    const conversationId = slug as Id<"conversations">;
    const messagesData = await fetchQuery(api.messages.getMessagesByConversationId, {
      conversationId,
    });

    if (messagesData?.otherUser) {
      const fullName = `${messagesData.otherUser.name} ${messagesData.otherUser.lastname}`.trim();
      return {
        title: `Chat with ${fullName} - ActivitySearch`,
        description: `Chat with ${fullName} on ActivitySearch.`,
      };
    }
  } catch (error) {
    // Fallback if conversation not found or error
  }

  return {
    title: 'Chat - ActivitySearch',
    description: 'Chat with friends on ActivitySearch.',
  };
}

export default function IndividualChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
