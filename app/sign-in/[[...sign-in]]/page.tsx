import { ClerkProvider, SignIn } from '@clerk/nextjs';
import ConvexClientProvider from '@/components/ConvexClientProvider';

export default function Page() {
  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <header
          className="flex min-h-screen flex-col items-center justify-center py-2 px-2
          bg-gray-100"
        >
          <SignIn />
        </header>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
