import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - ActivitySearch',
  description: 'View and manage your ActivitySearch profile and account settings.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
