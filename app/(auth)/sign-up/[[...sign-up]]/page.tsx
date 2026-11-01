import CustomSignUp from "@/components/auth/CustomSignUp";
import "./style.css";
import { Suspense } from "react";
import SignUpLoading from "./loading";

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpLoading />}>
      <CustomSignUp />
    </Suspense>
  );
}
