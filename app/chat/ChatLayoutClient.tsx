"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConversationList } from "@/components/chat/ConversationList";
import { CreateTeamDialog } from "@/components/chat/CreateTeamDialog";
import { TeamInviteDialog } from "@/components/chat/TeamInviteDialog";
import { AddFriendDialog } from "@/components/chat/AddFriendDialog";
import { usePathname } from "next/navigation";
import { useUpdatePresence } from "@/lib/hooks/usePresence";
import { usePresenceContext } from "@/components/providers/PresenceProvider";
import { Id } from "@/convex/_generated/dataModel";
import { Spinner } from "@/components/ui/spinner";
import { ChatHeader } from "@/components/chat/ChatHeader";
import {
  ChatHeaderStateProvider,
  useChatHeaderState,
} from "@/components/chat/ChatHeaderState";

export default function ChatLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatHeaderStateProvider>
      <ChatLayoutClientContent>{children}</ChatLayoutClientContent>
    </ChatHeaderStateProvider>
  );
}

function ChatLayoutClientContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInviteTeam, setShowInviteTeam] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const pathname = usePathname();
  const { headerData } = useChatHeaderState();

  const currentUser = useQuery(api.users.current);
  const { userId } = usePresenceContext();
  const { updatePresence, leavePresence } = useUpdatePresence();

  // Update presence using Ably instead of Convex mutations
  useEffect(() => {
    if (!userId || !currentUser) return;

    // Enter presence channel as online when component mounts
    updatePresence("online");

    // Update presence on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updatePresence("online");
      } else {
        updatePresence("away");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Leave presence when component unmounts
      leavePresence();
    };
  }, [userId, currentUser, updatePresence, leavePresence]);

  // Determine current chat type and conversation ID from pathname
  const getCurrentChatInfo = () => {
    if (pathname === "/chat") {
      return { type: null, conversationId: null };
    }
    // Check for team route first (more specific)
    if (pathname.startsWith("/chat/team/")) {
      const slug = pathname.replace("/chat/team/", "");
      if (slug) {
        return { type: "team" as const, conversationId: null, slug };
      }
    }
    // Check for individual chat route - slug is now conversation ID
    if (pathname.startsWith("/chat/") && !pathname.startsWith("/chat/team/")) {
      const conversationId = pathname.replace("/chat/", "");
      if (conversationId) {
        return { type: "individual" as const, conversationId: conversationId as Id<"conversations">, slug: null };
      }
    }
    return { type: null, conversationId: null, slug: null };
  };

  const chatInfo = getCurrentChatInfo();
  const currentConversationId = chatInfo.conversationId;

  const handleSelectIndividual = (slug: string) => {
    void slug; // Required by ConversationList; navigation handled by ConversationList
  };

  const handleSelectTeam = (slug: string) => {
    void slug; // Required by ConversationList; navigation handled by ConversationList
  };

  const handleCreateTeamSuccess = () => {
    setShowCreateTeam(false);
    // Teams will be refetched automatically by Convex when data changes
    // No need to manually trigger refetch
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
      <div className="flex items-center justify-center h-[calc(100vh-var(--app-navbar-height))]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // On mobile: show list only when on /chat, show chat view only when in a conversation
  // On desktop: always show side-by-side layout
  const isOnChatListPage = pathname === "/chat";

  return (
    <>
      <div className="flex h-[calc(100vh-var(--app-navbar-height))] overflow-hidden">
        {/* Conversation List - Desktop: always visible, Mobile: only on /chat */}
        <div
          className={`${isOnChatListPage ? "block" : "hidden"
            } md:block w-full md:w-80 shrink-0 overflow-hidden flex flex-col`}
        >
          <ConversationList
            currentChatType={chatInfo.type}
            currentChatSlug={chatInfo.slug ?? null}
            currentConversationId={currentConversationId}
            onSelectIndividual={handleSelectIndividual}
            onSelectTeam={handleSelectTeam}
            onAddFriend={() => setShowAddFriend(true)}
            onCreateTeam={() => setShowCreateTeam(true)}
            onInviteToTeam={handleInviteToTeam}
          />
        </div>
        {/* Chat View - Desktop: always visible, Mobile: only when in conversation */}
        <div
          className={`${!isOnChatListPage ? "block" : "hidden"
            } md:flex flex-1 flex flex-col min-h-0 overflow-hidden`}
        >
          {headerData && (
            <ChatHeader
              displayName={headerData.displayName}
              username={headerData.username}
              profileUserId={headerData.profileUserId}
              teamId={headerData.teamId}
              teamIcon={headerData.teamIcon}
              isTeam={headerData.isTeam}
              sticky={false}
            />
          )}
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
    </>
  );
}
