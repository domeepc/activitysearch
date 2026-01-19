import CustomSignUp from "@/components/auth/CustomSignUp";
import NoScrollWrapper from "@/components/auth/NoScrollWrapper";
import "./style.css";
import { Suspense } from "react";
import SignUpLoading from "./loading";

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpLoading />}>
    <NoScrollWrapper>
      <CustomSignUp />
    </NoScrollWrapper>
    </Suspense>
  );
}
