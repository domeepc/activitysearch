"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getTagColorScheme } from "@/lib/tagColors";

export default function Tag({ label }: { label: string }) {
  // Fetch all unique tags from database
  const databaseTags = useQuery(api.activity.getAllTags);

  // useMemo not strictly necessary, but nice for repetitive tag rendering
  const colorScheme = useMemo(
    () => getTagColorScheme(label, databaseTags),
    [label, databaseTags]
  );

  return (
    <span
      className={`${colorScheme.bg} ${colorScheme.text} text-xs px-2 py-2 rounded max-w-max font-medium`}
    >
      {label}
    </span>
  );
}
