"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface AuthFormShellProps {
  children: React.ReactNode;
  cardClassName?: string;
  containerClassName?: string;
}

export function AuthFormShell({
  children,
  cardClassName,
  containerClassName,
}: AuthFormShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen items-start justify-center overflow-y-auto px-3 py-4 sm:px-4 sm:py-8",
        containerClassName
      )}
    >
      <Card
        className={cn(
          "w-full border-2 border-border shadow-xl",
          "max-w-sm sm:max-w-md",
          cardClassName
        )}
      >
        {children}
      </Card>
    </div>
  );
}

export const authFormStyles = {
  header: "space-y-1 p-4 sm:p-5",
  title: "text-xl font-bold sm:text-2xl",
  description: "text-sm text-muted-foreground",
  content: "space-y-4 p-4 sm:p-5",
  footer: "flex flex-col space-y-2 p-4 pt-0 sm:p-5 sm:pt-0",
  sectionTitle: "text-xs uppercase tracking-wide text-muted-foreground",
  error: "rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive",
};
