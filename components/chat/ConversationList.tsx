"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDot } from "./ActiveStatus";
import { TeamMembersDialog } from "./TeamMembersDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  Users,
  Plus,
  Check,
  CheckCheck,
  Search,
  MoreVertical,
  UserMinus,
  Ban,
  LogOut,
  Trash2,
  UserRoundPlus,
} from "lucide-react";

interface ConversationListProps {
  currentChatType: "individual" | "team" | null;
  currentChatSlug: string | null;
  currentConversationId: Id<"conversations"> | null;
  onSelectIndividual: (slug: string) => void;
  onSelectTeam: (slug: string) => void;
  onAddFriend: () => void;
  onCreateTeam?: () => void;
  onInviteToTeam?: (slug: string) => void;
}

export function ConversationList({
  currentChatType,
  currentChatSlug,
  currentConversationId,
  onSelectIndividual,
  onSelectTeam,
  onAddFriend,
  onCreateTeam,
  onInviteToTeam,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [showLeaveTeam, setShowLeaveTeam] = useState(false);
  const [showDeleteTeam, setShowDeleteTeam] = useState(false);
  const [showRemoveFriend, setShowRemoveFriend] = useState(false);
  const [showBlockFriend, setShowBlockFriend] = useState(false);
  // Track recently created conversation IDs for optimistic selection
  const [recentlyCreatedConversations, setRecentlyCreatedConversations] = useState<Map<Id<"users">, Id<"conversations">>>(new Map());
  const [selectedTeam, setSelectedTeam] = useState<{
    _id: Id<"teams">;
    teamName: string;
    teammates: Array<{
      _id: Id<"users">;
      name: string;
      lastname: string;
      username: string;
      slug: string;
      avatar: string;
    }>;
    admins: Id<"users">[];
    createdBy: Id<"users">;
  } | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<{
    _id: Id<"users">;
    slug: string;
    name: string;
  } | null>(null);

  const router = useRouter();
  const conversations = useQuery(api.messages.getConversations);
  const reservationConversations = useQuery(api.messages.getReservationConversations);
  const currentUser = useQuery(api.users.current);
  
  // Query the current conversation to get the other user ID for matching
  const currentConversationData = useQuery(
    api.messages.getMessagesByConversationId,
    currentConversationId && currentChatType === "individual"
      ? { conversationId: currentConversationId }
      : "skip"
  );
  
  // Get the other user ID from the current conversation
  const currentConversationOtherUserId = currentConversationData?.otherUser?._id || null;

  // Teams query - skip when not authenticated to avoid "Can't get current user"
  const teams = useQuery(api.teams.getMyTeams, currentUser ? {} : "skip");

  const removeFriend = useMutation(api.users.removeFriend);
  const blockUser = useMutation(api.users.blockUser);
  const leaveTeam = useMutation(api.teams.leaveTeam);
  const deleteTeam = useMutation(api.teams.deleteTeam);
  const removeFromTeam = useMutation(api.teams.removeFromTeam);
  const getOrCreateConversationId = useMutation(
    api.messages.getOrCreateConversationId
  );


  // Create stable friends array key to prevent unnecessary refetches
  // Only refetch when the actual friend IDs change (not just array reference)
  const friendsKey = useMemo(() => {
    const friends = currentUser?.friends;
    if (!friends || friends.length === 0) {
      return null;
    }
    // Create a stable string key from sorted friend IDs
    return [...friends].sort((a, b) => a.localeCompare(b)).join(",");
  }, [currentUser?.friends]);

  // Get all friends (including those without conversations)
  // Only refetch when friends array actually changes (using stable key)
  const allFriends = useQuery(
    api.users.getUsersByIds,
    friendsKey && currentUser?.friends
      ? { userIds: currentUser.friends }
      : "skip"
  );

  // Friends without conversations
  const friendsWithoutConversations = useMemo(() => {
    if (!allFriends) return [];
    // Get friend IDs that already have conversations
    const conversationFriendIds = new Set(
      conversations?.map((c) => c.userId.toString()) || []
    );
    return allFriends.filter(
      (friend) => !conversationFriendIds.has(friend._id.toString())
    );
  }, [allFriends, conversations]);

  // Filter out reservation conversations from regular conversations
  const regularConversations = useMemo(() => {
    if (!conversations) return [];
    const reservationIds = new Set(
      reservationConversations?.map((c) => c.reservationId?.toString()).filter(Boolean) || []
    );
    return conversations.filter((conv) => !conv.reservationId || !reservationIds.has(conv.reservationId?.toString()));
  }, [conversations, reservationConversations]);

  // Merge all friends (including organisers) into one list
  const allFriendsList = useMemo(() => {
    type FriendListItem = {
      _id: Id<"users">;
      name: string;
      lastname: string;
      username: string;
      slug: string;
      conversationId: Id<"conversations"> | null;
      avatar: string;
      role: string | undefined;
      lastActive: number | undefined;
      lastMessageTime: number;
      lastMessageReadStatus: "sent" | "delivered" | "read" | null;
    };

    const convFriends: FriendListItem[] =
      regularConversations?.map((conv) => ({
        _id: conv.userId,
        name: conv.name,
        lastname: conv.lastname,
        username: conv.username,
        slug: conv.slug,
        conversationId: conv.conversationId,
        avatar: conv.avatar,
        role: conv.role,
        lastActive: conv.lastActive,
        lastMessageTime: conv.lastMessageTime,
        lastMessageReadStatus: conv.lastMessageReadStatus,
      })) || [];

    const friendsWithoutConv: FriendListItem[] =
      friendsWithoutConversations.map((friend) => ({
        _id: friend._id,
        name: friend.name,
        lastname: friend.lastname,
        username: friend.username,
        slug: friend.slug,
        conversationId: null, // Will be created when first message is sent
        avatar: friend.avatar,
        role: friend.role,
        lastActive: friend.lastActive,
        lastMessageTime: 0,
        lastMessageReadStatus: null as "sent" | "delivered" | "read" | null,
      })) || [];

    const allFriends = [...convFriends, ...friendsWithoutConv];

    return allFriends.sort(
      (a, b) => b.lastMessageTime - a.lastMessageTime
    );
  }, [regularConversations, friendsWithoutConversations]);

  // Format timestamp as HH:MM
  const formatTime = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter reservation conversations based on search query
  const filteredReservationConversations = useMemo(() => {
    if (!reservationConversations) return [];
    if (!searchQuery.trim()) return reservationConversations;
    const query = searchQuery.toLowerCase();
    return reservationConversations.filter(
      (conv) =>
        conv.name.toLowerCase().includes(query) ||
        conv.lastname.toLowerCase().includes(query) ||
        conv.username.toLowerCase().includes(query) ||
        conv.activityName?.toLowerCase().includes(query)
    );
  }, [reservationConversations, searchQuery]);

  // Filter friends and teams based on search query
  const filteredFriendsList = useMemo(() => {
    if (!searchQuery.trim()) return allFriendsList;
    const query = searchQuery.toLowerCase();
    return allFriendsList.filter(
      (friend) =>
        friend.name.toLowerCase().includes(query) ||
        friend.lastname.toLowerCase().includes(query) ||
        friend.username.toLowerCase().includes(query)
    );
  }, [allFriendsList, searchQuery]);


  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!searchQuery.trim()) return teams;
    const query = searchQuery.toLowerCase();
    return teams.filter((team) => team.teamName.toLowerCase().includes(query));
  }, [teams, searchQuery]);

  // Get total friend count (after filtering)
  const friendCount = filteredFriendsList.length;
  const reservationCount = filteredReservationConversations.length;

  return (
    <div className="flex flex-col h-full py-4 border-r-0 md:border-r border-t border-gray-300 overflow-hidden bg-white">
      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4">
        {/* Friends Section */}
        <div className="mb-4">
          {(!searchQuery.trim() || filteredFriendsList.length > 0) && (
            <div className="mb-4 bg-cyan-100 p-2 rounded-lg text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Friends {!searchQuery.trim() && friendCount}</span>
              {!searchQuery.trim() &&
                onAddFriend &&
                filteredFriendsList.length > 0 && (
                  <button
                    onClick={onAddFriend}
                    className="h-6 w-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors shrink-0"
                    title="Add friend"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
            </div>
          )}
          {filteredFriendsList.length > 0 && (
            <>
              {filteredFriendsList.map((friend) => {
                // Use conversation ID for matching instead of slug
                // Check both the friend's conversationId and recently created ones
                const friendConversationId = friend.conversationId || recentlyCreatedConversations.get(friend._id) || null;
                // Convert both to strings for reliable comparison
                // Ensure we handle both string and Id types
                const currentIdStr = currentConversationId ? String(currentConversationId) : null;
                const friendIdStr = friendConversationId ? String(friendConversationId) : null;
                // Also match by user ID as a fallback (in case conversation data hasn't loaded yet)
                const matchesByConversationId = 
                  currentIdStr !== null &&
                  friendIdStr !== null &&
                  currentIdStr === friendIdStr;
                const matchesByUserId = 
                  currentConversationOtherUserId !== null &&
                  friend._id.toString() === currentConversationOtherUserId.toString();
                const isSelected =
                  currentChatType === "individual" &&
                  (matchesByConversationId || matchesByUserId);
                return (
                  <div
                    key={friend._id.toString()}
                    onClick={async () => {
                      // If no conversation ID exists, create one first
                      let conversationId: Id<"conversations"> | null = friend.conversationId;
                      if (!conversationId) {
                        try {
                          const newConversationId = await getOrCreateConversationId({
                            otherUserId: friend._id,
                          });
                          conversationId = newConversationId;
                          // Optimistically update the conversation ID for this friend
                          setRecentlyCreatedConversations(prev => {
                            const newMap = new Map(prev);
                            newMap.set(friend._id, newConversationId);
                            return newMap;
                          });
                        } catch (error) {
                          console.error(
                            "Failed to create conversation:",
                            error
                          );
                          return;
                        }
                      }
                      if (conversationId) {
                        router.push(`/chat/${conversationId}`);
                        onSelectIndividual(conversationId.toString());
                      }
                    }}
                    className={cn(
                      "w-full px-4 py-2 bg-gray-200 cursor-pointer mb-4 hover:bg-blue-200 transition-colors text-left flex items-center gap-3 rounded-lg",
                      isSelected && "bg-blue-100 border-2 border-blue-500"
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={friend.avatar} alt={friend.name} />
                        <AvatarFallback>
                          {friend.name[0]}
                          {friend.lastname[0]}
                        </AvatarFallback>
                      </Avatar>
                      <StatusDot
                        userId={friend._id}
                        lastActive={friend.lastActive}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate text-sm">
                          {friend.name} {friend.lastname}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {friend.lastMessageTime > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(friend.lastMessageTime)}
                          </span>
                        )}
                        {friend.lastMessageReadStatus === "sent" && (
                          <Check className="h-4 w-4 text-gray-400" />
                        )}
                        {friend.lastMessageReadStatus === "delivered" && (
                          <CheckCheck className="h-4 w-4 text-gray-400" />
                        )}
                        {friend.lastMessageReadStatus === "read" && (
                          <CheckCheck className="h-4 w-4 text-blue-500" />
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button className="h-6 w-6 flex items-center justify-center rounded transition-colors hover:bg-blue-300 cursor-pointer">
                              <MoreVertical className="h-4 w-4 " />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFriend({
                                  _id: friend._id,
                                  slug: friend.slug,
                                  name: `${friend.name} ${friend.lastname}`,
                                });
                                setShowRemoveFriend(true);
                              }}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove friend
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFriend({
                                  _id: friend._id,
                                  slug: friend.slug,
                                  name: `${friend.name} ${friend.lastname}`,
                                });
                                setShowBlockFriend(true);
                              }}
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Block
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Add Friend Button - Only show if no friends and not searching */}
          {filteredFriendsList.length === 0 &&
            onAddFriend &&
            !searchQuery.trim() && (
              <div className="mt-4 py-2 mb-4">
                <Button
                  onClick={onAddFriend}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  size="sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                      <Plus className="h-3 w-3" />
                    </div>
                    <span>Add friend</span>
                  </div>
                </Button>
              </div>
            )}
        </div>

        {/* Teams Section */}
        <div className="mb-4">
          {(!searchQuery.trim() ||
            (filteredTeams && filteredTeams.length > 0)) && (
            <div className="mb-4 bg-cyan-100 p-2 rounded-lg text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Teams</span>
              {!searchQuery.trim() &&
                filteredTeams &&
                filteredTeams.length > 0 &&
                onCreateTeam && (
                  <button
                    onClick={onCreateTeam}
                    className="h-6 w-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors shrink-0"
                    title="Create team"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
            </div>
          )}
          {filteredTeams && filteredTeams.length > 0 && (
            <>
              {filteredTeams.map((team) => {
                const isSelected = currentChatSlug === team.slug;
                return (
                  <div
                    key={team._id.toString()}
                    onClick={() => {
                      router.push(`/chat/team/${team.slug}`);
                      onSelectTeam(team.slug);
                    }}
                    className={cn(
                      "w-full px-4 py-2 mb-4 bg-gray-200 hover:bg-blue-200 transition-colors flex items-center gap-3 rounded-lg cursor-pointer",
                      isSelected && "bg-blue-100 border-2 border-blue-500"
                    )}
                  >
                    <div className="relative shrink-0">
                      {team.icon ? (
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={team.icon} alt={team.teamName} />
                          <AvatarFallback>
                            <Users className="h-6 w-6 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate text-sm">
                          {team.teamName}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {team.lastMessage && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(team.lastMessage.timestamp)}
                          </span>
                        )}
                        {team.lastMessageReadStatus === "sent" && (
                          <Check className="h-4 w-4 text-gray-400" />
                        )}
                        {team.lastMessageReadStatus === "delivered" && (
                          <CheckCheck className="h-4 w-4 text-gray-400" />
                        )}
                        {team.lastMessageReadStatus === "read" && (
                          <CheckCheck className="h-4 w-4 text-blue-500" />
                        )}
                        {onInviteToTeam && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInviteToTeam(team.slug);
                            }}
                            className="h-6 w-6 cursor-pointer rounded text-blue-600 hover:bg-blue-300  flex items-center justify-center transition-colors shrink-0"
                            title="Invite friends"
                          >
                            <UserRoundPlus className="h-4 w-4" />
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button className="h-6 w-6 flex items-center justify-center rounded transition-colors hover:bg-blue-300 cursor-pointer">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTeam({
                                  _id: team._id,
                                  teamName: team.teamName,
                                  teammates: team.teammates.map((t) => ({
                                    _id: t._id,
                                    name: t.name,
                                    lastname: t.lastname,
                                    username: t.username,
                                    slug: t.slug,
                                    avatar: t.avatar,
                                  })),
                                  admins: team.admins,
                                  createdBy: team.createdBy,
                                });
                                setShowTeamMembers(true);
                              }}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              List members
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {team.createdBy !== currentUser?._id && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTeam({
                                    _id: team._id,
                                    teamName: team.teamName,
                                    teammates: team.teammates.map((t) => ({
                                      _id: t._id,
                                      name: t.name,
                                      lastname: t.lastname,
                                      username: t.username,
                                      slug: t.slug,
                                      avatar: t.avatar,
                                    })),
                                    admins: team.admins,
                                    createdBy: team.createdBy,
                                  });
                                  setShowLeaveTeam(true);
                                }}
                              >
                                <LogOut className="h-4 w-4 mr-2" />
                                Leave team
                              </DropdownMenuItem>
                            )}
                            {team.createdBy === currentUser?._id && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTeam({
                                    _id: team._id,
                                    teamName: team.teamName,
                                    teammates: team.teammates.map((t) => ({
                                      _id: t._id,
                                      name: t.name,
                                      lastname: t.lastname,
                                      username: t.username,
                                      slug: t.slug,
                                      avatar: t.avatar,
                                    })),
                                    admins: team.admins,
                                    createdBy: team.createdBy,
                                  });
                                  setShowDeleteTeam(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete team
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {(!filteredTeams || filteredTeams.length === 0) &&
            onCreateTeam &&
            !searchQuery.trim() && (
              <div className="mt-4 py-2">
                <Button
                  onClick={onCreateTeam}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  size="sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                      <Users className="h-3 w-3" />
                    </div>
                    <span>Create team</span>
                  </div>
                </Button>
              </div>
            )}
        </div>

        {/* Reservation Chats Section */}
        {filteredReservationConversations.length > 0 && (
          <div className="mb-4">
            <div className="mb-4 bg-purple-100 p-2 rounded-lg text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Reservation Chats {!searchQuery.trim() && reservationCount}</span>
            </div>
            {filteredReservationConversations.map((conv) => {
              // Use conversation ID for matching instead of slug
              // Convert both to strings for reliable comparison
              // Ensure we handle both string and Id types
              const currentIdStr = currentConversationId ? String(currentConversationId) : null;
              const convIdStr = conv.conversationId ? String(conv.conversationId) : null;
              const isSelected =
                currentChatType === "individual" &&
                currentIdStr !== null &&
                convIdStr !== null &&
                currentIdStr === convIdStr;
              return (
                <div
                  key={conv.userId.toString()}
                  onClick={() => {
                    if (conv.conversationId) {
                      router.push(`/chat/${conv.conversationId}`);
                      onSelectIndividual(conv.conversationId.toString());
                    }
                  }}
                  className={cn(
                    "w-full px-4 py-2 bg-gray-200 hover:bg-purple-200 transition-colors text-left flex items-center gap-3 rounded-lg cursor-pointer mb-4",
                    isSelected && "bg-purple-300 border-2 border-purple-500"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={conv.avatar} alt={conv.name} />
                      <AvatarFallback>
                        {conv.name[0]}
                        {conv.lastname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <StatusDot
                      userId={conv.userId}
                      lastActive={conv.lastActive}
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-sm">
                        {conv.name} {conv.lastname}
                      </h3>
                      {conv.activityName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.activityName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {conv.lastMessageTime > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      )}
                      {conv.lastMessageReadStatus === "sent" && (
                        <Check className="h-4 w-4 text-gray-400" />
                      )}
                      {conv.lastMessageReadStatus === "read" && (
                        <CheckCheck className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {conversations === undefined ||
        teams === undefined ||
        currentUser === undefined ||
        (currentUser?.friends &&
          currentUser.friends.length > 0 &&
          allFriends === undefined) ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading...
          </div>
        ) : filteredFriendsList.length === 0 &&
          (!filteredTeams || filteredTeams.length === 0) &&
          filteredReservationConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery.trim()
              ? "No conversations found"
              : "No friends or teams yet"}
          </div>
        ) : null}
      </div>

      {/* Dialogs */}
      {selectedTeam && (
        <>
          <TeamMembersDialog
            open={showTeamMembers}
            onOpenChange={setShowTeamMembers}
            teamName={selectedTeam.teamName}
            teamId={selectedTeam._id}
            teammates={selectedTeam.teammates}
            admins={selectedTeam.admins}
            createdBy={selectedTeam.createdBy}
            currentUserId={currentUser?._id || ("" as Id<"users">)}
            onKickMember={async (teamId, userId) => {
              await removeFromTeam({ teamId, userId });
              setShowTeamMembers(false);
            }}
          />
          <ConfirmDialog
            open={showLeaveTeam}
            onOpenChange={setShowLeaveTeam}
            title="Leave Team"
            description={`Are you sure you want to leave "${selectedTeam.teamName}"? You will no longer receive messages from this team.`}
            confirmText="Leave"
            variant="destructive"
            onConfirm={async () => {
              await leaveTeam({ teamId: selectedTeam._id });
              // Teams will automatically update via Convex reactivity
              router.push("/chat");
            }}
          />
          <ConfirmDialog
            open={showDeleteTeam}
            onOpenChange={setShowDeleteTeam}
            title="Delete Team"
            description={`Are you sure you want to delete "${selectedTeam.teamName}"? This action cannot be undone. All messages and team data will be permanently deleted.`}
            confirmText="Delete"
            variant="destructive"
            onConfirm={async () => {
              await deleteTeam({ teamId: selectedTeam._id });
              // Teams will automatically update via Convex reactivity
              router.push("/chat");
            }}
          />
        </>
      )}

      {selectedFriend && (
        <>
          <ConfirmDialog
            open={showRemoveFriend}
            onOpenChange={setShowRemoveFriend}
            title="Remove Friend"
            description={`Are you sure you want to remove ${selectedFriend.name} from your friends list?`}
            confirmText="Remove"
            variant="destructive"
            onConfirm={async () => {
              await removeFriend({ friendId: selectedFriend._id });
              router.push("/chat");
            }}
          />
          <ConfirmDialog
            open={showBlockFriend}
            onOpenChange={setShowBlockFriend}
            title="Block User"
            description={`Are you sure you want to block ${selectedFriend.name}? You won't be able to see their information or messages until you unblock them.`}
            confirmText="Block"
            variant="destructive"
            onConfirm={async () => {
              await blockUser({ userId: selectedFriend._id });
              router.push("/chat");
            }}
          />
        </>
      )}
    </div>
  );
}
