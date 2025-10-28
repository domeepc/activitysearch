import { SignUp } from '@clerk/nextjs';

import './style.css';

export default function SignUpPage() {
  return (
    <div className="sign_up">
      <SignUp />
    </div>
  );
}
