import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - ActivitySearch',
  description: 'Sign in to your ActivitySearch account to discover and book activities.',
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
