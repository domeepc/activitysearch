import CustomSignIn from "@/components/auth/CustomSignIn";
import "./style.css";
import { Suspense } from "react";
import SignInLoading from "./loading";

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <CustomSignIn />
    </Suspense>
  );
}
