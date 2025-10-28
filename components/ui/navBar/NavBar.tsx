'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Calendar, Home, MessageSquare } from 'lucide-react';

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
      <ul>
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

      <Authenticated>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger className="profile_button">
              <Avatar>
                <AvatarImage src={avatarUrl} />
              </Avatar>
              <span>{user?.name}</span>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="profile_menu">
              <DropdownMenuGroup>
                <DropdownMenuItem>My account</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
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
