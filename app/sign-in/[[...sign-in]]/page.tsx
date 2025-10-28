import { SignIn } from '@clerk/nextjs';
import './style.css';
export default function SignInPage() {
  return (
    <div className="sign_in">
      <SignIn />
    </div>
  );
}
