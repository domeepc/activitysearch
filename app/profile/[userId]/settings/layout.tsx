import type { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

function looksLikeConvexId(s: string): boolean {
  return /^[a-z0-9]{32}$/.test(s);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  
  try {
    if (looksLikeConvexId(userId)) {
      const user = await fetchQuery(api.users.getUserById, {
        userId: userId as Id<"users">,
      });

      if (user) {
        const fullName = `${user.name} ${user.lastname}`.trim();
        return {
          title: `Settings - ${fullName} - ActivitySearch`,
          description: `Manage your account settings on ActivitySearch.`,
        };
      }
    } else {
      const user = await fetchQuery(api.users.getUserByUsername, {
        username: userId,
      });

      if (user) {
        const fullName = `${user.name} ${user.lastname}`.trim();
        return {
          title: `Settings - ${fullName} - ActivitySearch`,
          description: `Manage your account settings on ActivitySearch.`,
        };
      }
    }
  } catch (error) {
    // Fallback if user not found or error
  }

  return {
    title: 'Settings - ActivitySearch',
    description: 'Manage your account settings on ActivitySearch.',
  };
}

export default function ProfileSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
