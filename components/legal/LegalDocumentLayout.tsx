import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LegalDocumentLayoutProps {
  title: string;
  lastUpdated?: string;
  /** Short labels shown above the title (e.g. Legal, document type). */
  badges?: string[];
  children: ReactNode;
}

const labelBadgeClass =
  "rounded-full border-0 bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 px-3 py-0.5 text-xs font-medium text-white shadow-sm shadow-blue-500/25 ring-1 ring-white/25 dark:from-sky-500 dark:via-blue-600 dark:to-blue-700 dark:shadow-blue-900/40 dark:ring-white/15";

const lastUpdatedBadgeClass =
  "rounded-full border-0 bg-gradient-to-r from-blue-800 via-blue-900 to-blue-950 px-3 py-0.5 text-xs font-medium text-sky-100 shadow-sm shadow-blue-950/40 ring-1 ring-blue-950/50 dark:from-blue-950 dark:via-slate-950 dark:to-blue-950 dark:text-sky-50 dark:ring-black/30";

export function LegalDocumentLayout({
  title,
  lastUpdated,
  badges = [],
  children,
}: LegalDocumentLayoutProps) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <div className="space-y-10 text-sm leading-relaxed text-zinc-700">
        <header className="space-y-6 bg-transparent">
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((label) => (
              <Badge
                key={label}
                variant="outline"
                className={cn(labelBadgeClass)}
              >
                {label}
              </Badge>
            ))}
            {lastUpdated ? (
              <Badge variant="outline" className={cn(lastUpdatedBadgeClass)}>
                Updated {lastUpdated}
              </Badge>
            ) : null}
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
            {title}
          </h1>
        </header>
        <div className="space-y-10 [&_h2]:mt-0 [&_p]:text-zinc-600">
          {children}
        </div>
      </div>
    </main>
  );
}
