import type { Metadata } from 'next';
import ChatLayoutClient from './ChatLayoutClient';

export const metadata: Metadata = {
  title: 'Chat - ActivitySearch',
  description: 'Connect with friends and teams through messaging on ActivitySearch.',
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatLayoutClient>{children}</ChatLayoutClient>;
}
