import { Baby, Clock, Gauge, Users } from "lucide-react";
import { getDifficultyColorScheme } from "@/lib/tagColors";
import { formatDuration } from "@/lib/utils";

interface ActivityDetailFactsProps {
  durationMinutes: number;
  difficulty: string;
  maxParticipants: number;
  minAge: number;
}

/** The at-a-glance row under the title: duration, level, group size, age. */
export function ActivityDetailFacts({ durationMinutes, difficulty, maxParticipants, minAge }: ActivityDetailFactsProps) {
  const duration = formatDuration(durationMinutes);
  const level = getDifficultyColorScheme(difficulty);
  const facts = [
    duration && { icon: Clock, label: "Duration", value: duration },
    difficulty && {
      icon: Gauge,
      label: "Level",
      value: (
        <span className="inline-flex items-center gap-1.5 capitalize">
          <span className="size-2 rounded-full" style={{ backgroundColor: level.textHex }} aria-hidden="true" />
          {difficulty}
        </span>
      ),
    },
    maxParticipants > 0 && { icon: Users, label: "Group size", value: `Up to ${maxParticipants}` },
    minAge > 0 && { icon: Baby, label: "Minimum age", value: `${minAge}+` },
  ].filter(Boolean) as Array<{ icon: typeof Clock; label: string; value: React.ReactNode }>;

  if (facts.length === 0) return null;

  return (
    <dl className="flex flex-wrap gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
      {facts.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex flex-[1_1_130px] flex-col gap-1 bg-white p-3.5 dark:bg-zinc-900">
          <dt className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </dt>
          <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
