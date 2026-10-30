"use client";

import { Button } from "@/components/ui/button";

interface PasswordSectionProps {
  hasPassword: boolean;
  onSetPassword: () => void;
}

export function PasswordSection({
  hasPassword,
  onSetPassword,
}: PasswordSectionProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-medium">Password</p>
        <p className="text-sm text-muted-foreground">
          {hasPassword
            ? "Change the password you use to sign in with email."
            : "You sign in with a connected account. Set a password to also sign in with email."}
        </p>
      </div>
      <Button variant="outline" onClick={onSetPassword} className="rounded-xl">
        {hasPassword ? "Change password" : "Set password"}
      </Button>
    </div>
  );
}
