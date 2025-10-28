'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Calendar, Home, HomeIcon, MessageSquare } from 'lucide-react';

import Link from 'next/link';

import './style.css';
import { AvatarImage, Avatar } from '@/components/ui/avatar';
import { Authenticated, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { SignOutButton } from '@clerk/nextjs';

export default function Navbar() {
  const user = useQuery(api.users.current);
  const avatarUrl = user?.avatar;

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
              <Avatar>
                <AvatarImage src={avatarUrl} />
              </Avatar>
              <span className="hidden md:flex">{user?.name}</span>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="profile_menu">
              <DropdownMenuGroup>
                <DropdownMenuItem>My account</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuGroup className="block md:hidden">
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link
                    href="/"
                    className="flex gap-1 align-middle justify-center"
                  >
                    <HomeIcon className="icon" /> Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link
                    href="/reservations"
                    className="flex gap-1 align-middle justify-center"
                  >
                    <Calendar className="icon" /> Reservations
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link
                    href="/chat"
                    className="flex gap-1 justify-center align-middle"
                  >
                    <MessageSquare className="icon" /> Chat
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <SignOutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Authenticated>
    </nav>
  );
}
