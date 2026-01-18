"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
import { Authenticated, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useClerk } from "@clerk/nextjs";
import { DropdownMenuLabel } from "@radix-ui/react-dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useUnreadReservationCount } from "@/lib/hooks/useReservations";
import { useUnreadMessageCount } from "@/lib/hooks/useUnreadMessageCount";

export default function Navbar() {
  const { signOut } = useClerk();
  const user = useQuery(api.users.current);
  const { count: unreadReservationCount } = useUnreadReservationCount();
  const { count: unreadMessageCount } = useUnreadMessageCount();
  const isOrganiser = user?.role === "organiser";

  return (
    <nav>
      <Link href="/" className="logo-link">
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

              <DropdownMenuGroup className="block md:hidden">
                <DropdownMenuSeparator />
                <Link href="/chat">
                  <DropdownMenuItem className="relative">
                    <MessageSquare className="icon" /> Chat
                    {unreadMessageCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-xs"
                      >
                        {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                </Link>
                {isOrganiser && (
                  <Link href="/reservations">
                    <DropdownMenuItem className="relative">
                      <Inbox className="icon" /> Reservations
                      {unreadReservationCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-xs"
                        >
                          {unreadReservationCount > 99 ? "99+" : unreadReservationCount}
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  </Link>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="sign_out"
                onSelect={() => signOut({ redirectUrl: "/" })}
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
