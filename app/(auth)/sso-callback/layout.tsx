import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Signing In - ActivitySearch',
  description: 'Completing your sign in to ActivitySearch.',
};

export default function SSOCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
