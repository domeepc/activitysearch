"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const router = useRouter();
  const user = useQuery(api.users.current);

  useEffect(() => {
    if (user?.slug) {
      router.replace(`/profile/${user.slug}`);
    } else if (user && !user.slug) {
      // If user exists but has no slug, generate one from username
      console.error(
        "User has no slug. Please update your profile to generate one."
      );
    }
  }, [user, router]);

  if (user === undefined) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
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

  if (!user.slug) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">
              Setting up your profile... Please refresh the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
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
