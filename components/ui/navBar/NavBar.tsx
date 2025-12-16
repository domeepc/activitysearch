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
  Calendar,
  Home,
  HomeIcon,
  LogOut,
  MessageSquare,
  Settings,
  User,
  Building2,
} from "lucide-react";

import Link from "next/link";

import "./style.css";
import { AvatarImage, Avatar } from "@/components/ui/avatar";
import { Authenticated, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SignOutButton } from "@clerk/nextjs";
import { DropdownMenuLabel } from "@radix-ui/react-dropdown-menu";

export default function Navbar() {
  const user = useQuery(api.users.current);

  return (
    <nav>
      <h1>NavBar</h1>

      <Authenticated>
        <ul className="md:flex hidden">
          <li>
            <Link href="/">
              <Home className="icon" /> Home
            </Link>
          </li>
          <li>
            <Link href="/reservations">
              <Calendar className="icon" /> Reservations
            </Link>
          </li>
          <li>
            <Link href="/chat">
              <MessageSquare className="icon" /> Chat
            </Link>
          </li>
        </ul>

        <div>
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
                {user?.role === "organizer" && (
                  <Link href="/my-organisation">
                    <DropdownMenuItem>
                      <Building2 className="icon" />
                      My Organisation
                    </DropdownMenuItem>
                  </Link>
                )}
                <Link href="/settings">
                  <DropdownMenuItem>
                    <Settings className="icon" />
                    Settings
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>

              <DropdownMenuGroup className="block md:hidden">
                <DropdownMenuSeparator />
                <Link href="/">
                  <DropdownMenuItem>
                    <HomeIcon className="icon" /> Home
                  </DropdownMenuItem>
                </Link>
                <Link href="/reservations">
                  <DropdownMenuItem>
                    <Calendar className="icon" /> Reservations
                  </DropdownMenuItem>
                </Link>
                <Link href="/chat">
                  <DropdownMenuItem>
                    <MessageSquare className="icon" /> Chat
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="sign_out">
                <LogOut className="icon" />
                <SignOutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Authenticated>
    </nav>
  );
}
