import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import ConvexClientProvider from '@/components/ConvexClientProvider';
import { PresenceProviderWrapper } from '@/components/PresenceProviderWrapper';
import Navbar from '@/components/ui/navBar/NavBar';
import { Suspense } from 'react';
import Loading from '@/app/loading';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'ActivitySearch - Discover and Book Activities',
  description: 'Find and book activities, connect with organisers, and manage your reservations all in one place.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={<Loading />}>
        <ClerkProvider>
          <ConvexClientProvider>
            <PresenceProviderWrapper>
              <header>
                <Navbar />
              </header>
              {children}
            </PresenceProviderWrapper>
          </ConvexClientProvider>
        </ClerkProvider>
        </Suspense> 
      </body>
    </html>

  );
}
