import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const LEGAL_SUPPORT_EMAIL = "domagoj.milardovic@activitysearch.eu";

const sectionTitleBadgeClass =
  "h-auto mb-8 max-w-full whitespace-normal border border-sky-300/60 bg-gradient-to-br from-sky-50 via-blue-50 to-blue-100 px-3 py-2 text-left text-base font-semibold leading-snug text-blue-950 shadow-sm shadow-blue-500/10 dark:border-blue-800/80 dark:from-blue-950/80 dark:via-slate-900 dark:to-blue-950 dark:text-sky-100 dark:shadow-black/20";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="m-0">
        <Badge variant="outline" className={cn(sectionTitleBadgeClass)}>
          {title}
        </Badge>
      </h2>
      {children}
    </section>
  );
}
