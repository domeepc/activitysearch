import { Spinner } from "@/components/ui/spinner";
import NoScrollWrapper from "@/components/auth/NoScrollWrapper";

export default function Loading() {
  return (
    <NoScrollWrapper>
      <div className="flex items-center justify-center min-h-screen w-full">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    </NoScrollWrapper>
  );
}
