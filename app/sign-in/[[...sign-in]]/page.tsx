import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className=" overflow-hidden fixed flex justify-center items-center inset-0 bg-gray-200">
      <SignIn />
    </div>
  );
}
