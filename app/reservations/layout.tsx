import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reservations - ActivitySearch',
  description: 'Manage your activity reservations and payments as an organiser.',
};

export default function ReservationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
