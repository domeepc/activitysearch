"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface PasswordSectionProps {
  hasPassword: boolean;
  onSetPassword: () => void;
}

export function PasswordSection({
  hasPassword,
  onSetPassword,
}: PasswordSectionProps) {
  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Password:</p>
        <Badge
          variant={hasPassword ? "default" : "outline"}
          className="flex items-center gap-1"
        >
          <Lock className="h-3 w-3" />
          {hasPassword ? "Set" : "Not Set"}
        </Badge>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onSetPassword}
        className="w-full"
      >
        {hasPassword ? "Change Password" : "Set Password"}
      </Button>
    </div>
  );
}

