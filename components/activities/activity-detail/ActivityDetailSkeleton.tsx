import { Skeleton } from "@/components/ui/skeleton";

export function ActivityDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-6 md:pt-8">
      <Skeleton className="h-64 w-full rounded-3xl sm:h-80 md:h-[420px]" />
      <div className="mt-6 flex flex-wrap gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-4 h-20 w-full rounded-2xl" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="hidden h-60 flex-[1_1_320px] rounded-3xl lg:block" />
      </div>
    </div>
  );
}
