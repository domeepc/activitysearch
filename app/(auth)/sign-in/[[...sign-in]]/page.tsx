import CustomSignIn from "@/components/auth/CustomSignIn";
import NoScrollWrapper from "@/components/auth/NoScrollWrapper";
import "./style.css";
import { Suspense } from "react";
import SignInLoading from "./loading";

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
    <NoScrollWrapper>
      <CustomSignIn />
    </NoScrollWrapper>
    </Suspense>
  );
}
