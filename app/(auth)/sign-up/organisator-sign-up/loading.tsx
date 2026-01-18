import NoScrollWrapper from "@/components/auth/NoScrollWrapper";
import { Spinner } from "@/components/ui/spinner";

export default function OrganisatorSignUpLoading() {
  return (
    <NoScrollWrapper>
      <div className="flex items-center justify-center min-h-screen w-full">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    </NoScrollWrapper>
  );
}
