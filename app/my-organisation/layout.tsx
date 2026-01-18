import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Organisation - ActivitySearch',
  description: 'Manage your organisation information, activities, and settings.',
};

export default function MyOrganisationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
