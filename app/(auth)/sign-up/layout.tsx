import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - ActivitySearch',
  description: 'Create your ActivitySearch account to start discovering and booking activities.',
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
