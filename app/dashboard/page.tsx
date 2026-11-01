"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function DashboardPage() {
  const router = useRouter();
  const user = useQuery(api.users.current);

  useEffect(() => {
    if (user?._id) {
      router.replace(`/profile/${user._id}`);
    }
  }, [user, router]);

  if (user === undefined) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Spinner className="h-8 w-8" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">
              Please sign in to view your profile.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">
            Redirecting to your profile...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
