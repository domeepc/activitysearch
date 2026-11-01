import Link from "next/link";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "participant", href: "/sign-up", title: "Join activities", sub: "Book with friends, earn XP" },
  { id: "organiser", href: "/sign-up/organisator-sign-up", title: "Host activities", sub: "List, get paid via Stripe" },
] as const;

/** Lets people move between the participant and organiser sign-up flows. */
export function AccountTypeSwitch({ active }: { active: (typeof OPTIONS)[number]["id"] }) {
  return (
    <nav aria-label="Account type" className="grid grid-cols-2 gap-2">
      {OPTIONS.map((option) => {
        const isActive = option.id === active;
        return (
          <Link
            key={option.id}
            href={option.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-2xl px-4 py-3 text-left transition-colors",
              isActive
                ? "pointer-events-none border-2 border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                : "border border-border hover:border-foreground/30 hover:bg-muted"
            )}
          >
            <span className="block text-[0.9375rem] font-semibold">{option.title}</span>
            <span className="block text-xs text-muted-foreground">{option.sub}</span>
          </Link>
        );
      })}
    </nav>
  );
}
