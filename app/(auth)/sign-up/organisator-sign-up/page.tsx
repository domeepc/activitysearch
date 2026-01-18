import NoScrollWrapper from "@/components/auth/NoScrollWrapper";
import CustomSignUpORG from "@/components/CustomSignUpORG";
import OrganisatorSignUpLoading from "./loading";
import { Suspense } from "react";

export default function OrganisatorSignUpPage() {
  return (
    <Suspense fallback={<OrganisatorSignUpLoading />}>
    <NoScrollWrapper>
      <CustomSignUpORG />
    </NoScrollWrapper>
    </Suspense>
  );
}
