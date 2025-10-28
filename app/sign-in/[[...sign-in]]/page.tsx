import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <header
      className="flex min-h-screen flex-col items-center justify-center py-2 px-2
          bg-gray-100"
    >
      <SignIn />
    </header>
  );
}
