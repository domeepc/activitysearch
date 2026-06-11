"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface ProfileInfoProps {
  name: string;
  lastname: string;
  username?: string;
  description: string;
  contact?: string;
  isOwnProfile: boolean;
  isLoading?: boolean;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="text-sm text-zinc-700">{value}</span>
    </div>
  );
}

export function ProfileInfo({
  name,
  lastname,
  username,
  description,
  contact,
  isOwnProfile,
  isLoading = false,
}: ProfileInfoProps) {
  if (isLoading) {
    return (
      <div className="divide-y divide-zinc-100">
        {[80, 96, 64, 160, 120].map((w, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-3 w-24 shrink-0" />
            <Skeleton className={`h-4 w-${w}`} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      <InfoRow label="Name" value={`${name} ${lastname}`} />
      {username && <InfoRow label="Username" value={`@${username}`} />}
      <InfoRow
        label={isOwnProfile ? "Description" : "About"}
        value={description || "No description provided"}
      />
      {(isOwnProfile || contact) && (
        <InfoRow label="Contact" value={contact || "No contact information"} />
      )}
    </div>
  );
}
