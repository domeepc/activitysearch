"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Authenticated, useQuery } from "convex/react";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  Building2,
  ChevronDown,
  Compass,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  User,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { SIGNED_IN_HOME_HREF } from "@/lib/routes";
import { useUnreadReservationCount } from "@/lib/hooks/useReservations";
import { useUnreadMessageCount } from "@/lib/hooks/useUnreadMessageCount";
import { cn } from "@/lib/utils";

function CountPill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-blue-600 px-1 text-[10px] font-bold leading-none text-white tabular-nums md:static md:h-5 md:min-w-5 md:border-0 dark:border-zinc-950">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const user = useQuery(api.users.current, isLoaded && isSignedIn ? {} : "skip");
  const { count: unreadReservationCount } = useUnreadReservationCount();
  const { count: unreadMessageCount } = useUnreadMessageCount();
  const isOrganiser = user?.role === "organiser";
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const links = [
    { href: SIGNED_IN_HOME_HREF, label: "Explore", icon: Compass, count: 0, match: ["/home", "/activities"] },
    { href: "/chat", label: "Messages", icon: MessageSquare, count: unreadMessageCount, match: ["/chat"] },
    ...(isOrganiser
      ? [
          { href: "/my-organisation", label: "Dashboard", icon: LayoutDashboard, count: 0, match: ["/my-organisation"] },
          { href: "/reservations", label: "Reservations", icon: Inbox, count: unreadReservationCount, match: ["/reservations"] },
        ]
      : []),
  ];

  return (
    <nav aria-label="Main" className="mx-auto flex h-(--app-navbar-height) w-full max-w-7xl items-center gap-3 px-4 md:px-6">
      <Link
        href={isSignedIn ? SIGNED_IN_HOME_HREF : "/"}
        className="mr-auto flex shrink-0 items-center rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring md:mr-4"
        aria-label="ActivitySearch home"
      >
        <Image src="/full-logo.svg" alt="" width={160} height={40} className="hidden h-9 w-auto md:block dark:md:hidden" priority />
        <Image src="/full-logo-dark.svg" alt="" width={160} height={40} className="hidden h-9 w-auto dark:md:block" priority />
        <Image src="/mobile-logo.svg" alt="" width={40} height={40} className="block h-9 w-auto md:hidden dark:hidden" priority />
        <Image src="/mobile-logo-dark.svg" alt="" width={40} height={40} className="hidden h-9 w-auto dark:block dark:md:hidden" priority />
      </Link>

      {isLoaded && !isSignedIn ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="h-10">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="h-10 bg-blue-600 font-semibold text-white hover:bg-blue-700">
            <Link href="/sign-up">Sign up</Link>
          </Button>
        </div>
      ) : null}

      <Authenticated>
        <ul className="flex items-center gap-1 md:mr-auto">
          {links.map(({ href, label, icon: Icon, count, match }) => {
            const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={count > 0 ? `${label}, ${count} unread` : label}
                  className={cn(
                    "relative inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors md:px-3",
                    active
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  )}
                >
                  <Icon className={cn("size-5 md:size-4", active && "text-blue-600 dark:text-blue-400")} aria-hidden="true" />
                  <span className="hidden md:inline">{label}</span>
                  <CountPill count={count} />
                </Link>
              </li>
            );
          })}
        </ul>

        <DropdownMenu>
          <DropdownMenuTrigger className="group inline-flex h-10 items-center gap-2 rounded-xl p-1 outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-zinc-100 md:border md:border-zinc-200 md:py-1 md:pl-1 md:pr-3 dark:hover:bg-zinc-800 dark:data-[state=open]:bg-zinc-800 md:dark:border-zinc-800">
            <Avatar className="size-9 md:size-7">
              <AvatarImage src={user?.avatar} alt="" />
              <AvatarFallback className="text-xs font-bold">{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate text-sm font-medium md:inline">{user?.name}</span>
            <ChevronDown className="hidden size-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180 md:block" aria-hidden="true" />
            <span className="sr-only">Account menu</span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-2xl p-2">
            <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
              <Avatar className="size-9">
                <AvatarImage src={user?.avatar} alt="" />
                <AvatarFallback className="text-xs font-bold">{user?.name?.[0]}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <b className="block truncate text-sm">{user ? `${user.name} ${user.lastname}` : ""}</b>
                {user?.username && <span className="block truncate text-xs text-zinc-500">@{user.username}</span>}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="h-9 rounded-lg">
                <Link href="/dashboard">
                  <User /> My account
                </Link>
              </DropdownMenuItem>
              {isOrganiser && (
                <DropdownMenuItem asChild className="h-9 rounded-lg">
                  <Link href="/my-organisation">
                    <Building2 /> My organisation
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                role="menuitemcheckbox"
                aria-checked={isDark}
                className="h-9 justify-between rounded-lg"
                onSelect={(e) => {
                  // Keep the menu open so the switch visibly flips.
                  e.preventDefault();
                  setTheme(isDark ? "light" : "dark");
                }}
              >
                <span className="flex items-center gap-2">
                  <Moon /> Dark mode
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                    isDark ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                      isDark ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="h-9 rounded-lg"
              onSelect={async (event) => {
                event.preventDefault();
                // Full reload clears client state (Convex, layout) after sign-out.
                await signOut(() => {
                  window.location.replace("/");
                });
              }}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Authenticated>
    </nav>
  );
}
