import { ClerkProvider, SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <ClerkProvider>
      <header className="flex min-h-screen flex-col items-center justify-center py-2">
        <SignIn />
      </header>
    </ClerkProvider>
  );
}
