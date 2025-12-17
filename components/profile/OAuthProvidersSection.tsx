"use client";

import { Badge } from "@/components/ui/badge";
import type { OAuthProvider } from "@/lib/types/profile";

interface OAuthProvidersSectionProps {
  externalAccounts: Array<{
    id: string;
    provider: string;
  }>;
  onUnlink: (provider: OAuthProvider) => void;
}

export function OAuthProvidersSection({
  externalAccounts,
  onUnlink,
}: OAuthProvidersSectionProps) {
  if (!externalAccounts || externalAccounts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Linked accounts:</p>
      <div className="flex flex-wrap gap-2">
        {externalAccounts.map((account) => (
          <Badge
            key={account.id}
            variant="secondary"
            className="flex items-center gap-2"
          >
            {account.provider}
            <button
              onClick={() =>
                onUnlink(account.provider as OAuthProvider)
              }
              className="hover:text-destructive"
              title={`Unlink ${account.provider}`}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

