import { Card, CardContent } from "@/components/ui/card";

export function ActivityDetailNotFound() {
  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <h2 className="mb-2 text-2xl font-semibold">Activity Not Found</h2>
          <p className="mb-4 text-muted-foreground">
            The activity you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecting to home page...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
