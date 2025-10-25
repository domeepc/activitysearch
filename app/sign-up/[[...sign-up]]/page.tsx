import { ClerkProvider, SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <ClerkProvider>
      <header className="flex min-h-screen flex-col items-center justify-center py-2">
        <SignUp />
      </header>
    </ClerkProvider>
  );
}
