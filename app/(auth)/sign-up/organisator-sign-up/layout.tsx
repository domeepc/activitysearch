import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Organiser Sign Up - ActivitySearch',
  description: 'Sign up as an organiser to create and manage activities on ActivitySearch.',
};

export default function OrganisatorSignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
