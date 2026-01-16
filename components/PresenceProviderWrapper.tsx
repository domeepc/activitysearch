"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

// Dynamically import PresenceProvider to avoid SSR issues with Ably
const PresenceProvider = dynamic(
  () => import("@/components/PresenceProvider").then((mod) => mod.PresenceProvider),
  { ssr: false }
);

interface PresenceProviderWrapperProps {
  children: ReactNode;
}

export function PresenceProviderWrapper({ children }: PresenceProviderWrapperProps) {
  return <PresenceProvider>{children}</PresenceProvider>;
}
