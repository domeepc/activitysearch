import CustomSignUp from "@/components/CustomSignUp";
import NoScrollWrapper from "@/components/auth/NoScrollWrapper";
import "./style.css";

export default function SignUpPage() {
  return (
    <NoScrollWrapper>
      <CustomSignUp />
    </NoScrollWrapper>
  );
}
