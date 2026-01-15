"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConversationList } from "@/components/chat/ConversationList";
import { CreateTeamDialog } from "@/components/chat/CreateTeamDialog";
import { TeamInviteDialog } from "@/components/chat/TeamInviteDialog";
import { AddFriendDialog } from "@/components/chat/AddFriendDialog";
import { usePathname } from "next/navigation";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInviteTeam, setShowInviteTeam] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const pathname = usePathname();

  const currentUser = useQuery(api.users.current);
  const updateLastActive = useMutation(api.presence.updateLastActive);

  // Update last active periodically
  useEffect(() => {
    if (!currentUser) return;

    // Update immediately
    updateLastActive();

    // Update every 30 seconds
    const interval = setInterval(() => {
      updateLastActive();
    }, 30000);

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateLastActive();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUser, updateLastActive]);

  // Determine current chat type and slug from pathname
  const getCurrentChatInfo = () => {
    if (pathname === "/chat") {
      return { type: null, slug: null };
    }
    // Check for team route first (more specific)
    if (pathname.startsWith("/chat/team/")) {
      const slug = pathname.replace("/chat/team/", "");
      if (slug) {
        return { type: "team" as const, slug };
      }
    }
    // Check for individual chat route
    if (pathname.startsWith("/chat/") && !pathname.startsWith("/chat/team/")) {
      const slug = pathname.replace("/chat/", "");
      if (slug) {
        return { type: "individual" as const, slug };
      }
    }
    return { type: null, slug: null };
  };

  const chatInfo = getCurrentChatInfo();

  const handleSelectIndividual = (slug: string) => {
    // Navigation will be handled by ConversationList using router
  };

  const handleSelectTeam = (slug: string) => {
    // Navigation will be handled by ConversationList using router
  };

  const handleCreateTeamSuccess = () => {
    setShowCreateTeam(false);
  };

  const handleInviteSuccess = () => {
    setShowInviteTeam(false);
    setInviteTeamId(null);
  };

  const handleInviteToTeam = (slug: string) => {
    setInviteTeamId(slug);
    setShowInviteTeam(true);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-80 shrink-0 overflow-hidden flex flex-col">
        <ConversationList
          currentChatType={chatInfo.type}
          currentChatSlug={chatInfo.slug}
          onSelectIndividual={handleSelectIndividual}
          onSelectTeam={handleSelectTeam}
          onAddFriend={() => setShowAddFriend(true)}
          onCreateTeam={() => setShowCreateTeam(true)}
          onInviteToTeam={handleInviteToTeam}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
      <CreateTeamDialog
        open={showCreateTeam}
        onOpenChange={setShowCreateTeam}
        onSuccess={handleCreateTeamSuccess}
      />
      {inviteTeamId && (
        <TeamInviteDialog
          open={showInviteTeam}
          onOpenChange={setShowInviteTeam}
          teamSlug={inviteTeamId}
          onSuccess={handleInviteSuccess}
        />
      )}
      <AddFriendDialog
        open={showAddFriend}
        onOpenChange={setShowAddFriend}
        onSuccess={() => {
          // Optionally refresh or show success message
        }}
      />
    </div>
  );
}
