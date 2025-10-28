import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="fixed flex justify-center items-center inset-0 bg-gray-200 overflow-hidden">
      <SignUp />
    </div>
  );
}
