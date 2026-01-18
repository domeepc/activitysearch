import CustomSignIn from "@/components/CustomSignIn";
import NoScrollWrapper from "@/components/auth/NoScrollWrapper";
import "./style.css";

export default function SignInPage() {
  return (
    <NoScrollWrapper>
      <CustomSignIn />
    </NoScrollWrapper>
  );
}
