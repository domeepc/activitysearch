import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <header className="flex min-h-screen flex-col items-center justify-center py-2">
      <SignUp />
    </header>
  );
}
