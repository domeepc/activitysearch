"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  LogOut,
  MessageSquare,
  User,
  Building2,
  Inbox,
} from "lucide-react";

import Link from "next/link";
import Image from "next/image";

import "./style.css";
import { AvatarImage, Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Authenticated, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth, useClerk } from "@clerk/nextjs";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { useUnreadReservationCount } from "@/lib/hooks/useReservations";
import { useUnreadMessageCount } from "@/lib/hooks/useUnreadMessageCount";

export default function Navbar() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const user = useQuery(
    api.users.current,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const { count: unreadReservationCount } = useUnreadReservationCount();
  const { count: unreadMessageCount } = useUnreadMessageCount();
  const isOrganiser = user?.role === "organiser";

  return (
    <nav className="app-navbar">
      <Link
        href={isSignedIn ? SIGNED_IN_HOME_HREF : "/"}
        className="logo-link"
      >
        <Image
          src="/full-logo.svg"
          alt="ActivitySearch"
          width={200}
          height={50}
          className="hidden md:block logo-desktop"
          priority
        />
        <Image
          src="/mobile-logo.svg"
          alt="ActivitySearch"
          width={50}
          height={50}
          className="block md:hidden logo-mobile"
          priority
        />
      </Link>

      {!isLoaded ? null : !isSignedIn ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="rounded-full">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/sign-up">Sign up</Link>
          </Button>
        </div>
      ) : null}

      <Authenticated>
        <div className="flex items-center justify-center gap-4">
          <Link href="/chat" className="relative inline-block">
            <MessageSquare className="icon" />
            {unreadMessageCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 w-max aspect-square rounded-full p-1.5 flex items-center justify-center text-xs leading-none"
              >
                {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
              </Badge>
            )}
          </Link>
          {isOrganiser && (
            <Link className="flex items-center justify-center" href="/reservations">
              <span className="relative inline-block">
                <Inbox className="icon" />
                {unreadReservationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-max aspect-square rounded-full p-1.5 flex items-center justify-center text-xs leading-none"
                  >
                    {unreadReservationCount > 99 ? "99+" : unreadReservationCount}
                  </Badge>
                )}
              </span>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className="profile_button">
              <Avatar className="size-10 md:size-8">
                <AvatarImage src={user?.avatar} />
              </Avatar>
              <span className="hidden md:flex">{user?.name}</span>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="profile_menu">
              <DropdownMenuLabel className="font-semibold pl-1.5">
                {user?.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <Link href="/dashboard">
                  <DropdownMenuItem>
                    <User className="icon" />
                    My account
                  </DropdownMenuItem>
                </Link>
                {user?.role === "organiser" && (
                  <Link href="/my-organisation">
                    <DropdownMenuItem>
                      <Building2 className="icon" />
                      My Organisation
                    </DropdownMenuItem>
                  </Link>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="sign_out"
                onSelect={async (event) => {
                  event.preventDefault();
                  // Full document reload clears client state (Convex, layout) and avoids a
                  // shifted layout after soft navigation to `/`.
                  await signOut(() => {
                    window.location.replace("/");
                  });
                }}
              >
                <LogOut className="icon" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Authenticated>
    </nav>
  );
}
