import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ProfileLoading() {
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          {/* Avatar skeleton */}
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email section */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Username section */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Description section */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>

          {/* Interests section */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>

          {/* OAuth Providers section */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>

          {/* Friends section */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-24" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
