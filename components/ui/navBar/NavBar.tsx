'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
        <li>Home</li>
        <li>About</li>
        <li>Contact</li>
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

            <DropdownMenuContent align="start">
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
