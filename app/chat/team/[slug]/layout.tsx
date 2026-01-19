import type { Metadata } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  
  try {
    const messagesData = await fetchQuery(api.teams.getTeamMessagesBySlug, {
      slug,
    });

    if (messagesData?.team) {
      return {
        title: `${messagesData.team.teamName} - Team Chat - ActivitySearch`,
        description: `Team chat for ${messagesData.team.teamName} on ActivitySearch.`,
      };
    }
  } catch {
    // Fallback if team not found or error
  }

  return {
    title: 'Team Chat - ActivitySearch',
    description: 'Team chat on ActivitySearch.',
  };
}

export default function TeamChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
