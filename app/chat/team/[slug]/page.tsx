"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChatView } from "@/components/chat/ChatView";

export default function TeamChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const router = useRouter();

  const messagesData = useQuery(api.teams.getTeamMessagesBySlug, {
    slug,
  });

  // Redirect to chat list if team not found or user is no longer a member
  useEffect(() => {
    if (messagesData === null) {
      router.push("/chat");
    }
  }, [messagesData, router]);

  if (messagesData === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading...</p>
      </div>
    );
  }

  if (messagesData === null || !messagesData.team) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">Team not found</p>
          <p className="text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  const messages = messagesData.messages.map((msg) => ({
    _id: msg._id,
    text: msg.text,
    timestamp: msg.timestamp,
    isFromCurrentUser: msg.isFromCurrentUser,
    senderName: msg.sender
      ? `${msg.sender.name} ${msg.sender.lastname}`
      : undefined,
    senderAvatar: msg.sender?.avatar,
    status: msg.status,
    encrypted: msg.encrypted || false,
  }));

  return (
    <ChatView
      type="team"
      teamId={messagesData.team._id}
      teamSlug={slug}
      messages={messages}
      teamName={messagesData.team.teamName}
      teamIcon={messagesData.team.icon}
    />
  );
}
