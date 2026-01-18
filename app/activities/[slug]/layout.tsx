import type { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  
  try {
    const activityId = slug as Id<"activities">;
    const activity = await fetchQuery(api.activity.getActivityById, {
      activityId,
    });

    if (activity) {
      return {
        title: `${activity.title} - ActivitySearch`,
        description: activity.description || `View details and book ${activity.title} on ActivitySearch.`,
      };
    }
  } catch (error) {
    // Fallback if activity not found or error
  }

  return {
    title: 'Activity - ActivitySearch',
    description: 'View activity details on ActivitySearch.',
  };
}

export default function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
