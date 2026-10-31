"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const useIsClient = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** Light / Dark / System picker (the navbar toggle only flips light ↔ dark). */
export function ThemePreference() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const current = isClient ? theme ?? "system" : undefined;

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const checked = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
              checked
                ? "bg-background font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
