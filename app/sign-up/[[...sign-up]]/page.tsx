import { ClerkProvider, SignUp } from '@clerk/nextjs';
import ConvexClientProvider from '@/components/ConvexClientProvider';

export default function SignUpPage() {
  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <header className="flex min-h-screen flex-col items-center justify-center py-2">
          <SignUp />
        </header>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
