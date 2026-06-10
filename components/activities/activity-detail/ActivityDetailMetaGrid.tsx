import { Badge } from "@/components/ui/badge";
import { Clock, Euro, MapPin, Users } from "lucide-react";
import { getDifficultyColorScheme } from "@/lib/tagColors";

interface ActivityDetailMetaGridProps {
  address: string;
  durationLabel: string;
  difficulty: string;
  priceAmount: number;
  currency?: string;
}

export function ActivityDetailMetaGrid({
  address,
  durationLabel,
  difficulty,
  priceAmount,
  currency = "€",
}: ActivityDetailMetaGridProps) {
  const difficultyColors = getDifficultyColorScheme(difficulty);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {address ? (
        <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <MapPin className="h-4.5 w-4.5 text-blue-500" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Address
            </p>
            <p className="mt-0.5 text-sm font-medium text-zinc-700 leading-snug">
              {address}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
          <Clock className="h-4.5 w-4.5 text-amber-500" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Duration
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-700">
            {durationLabel}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50">
          <Users className="h-4.5 w-4.5 text-violet-500" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Difficulty
          </p>
          <Badge
            variant="secondary"
            className="mt-1.5 capitalize"
            style={{
              backgroundColor: difficultyColors.bgHex,
              color: difficultyColors.textHex,
              borderColor: difficultyColors.bgHex,
            }}
          >
            {difficulty}
          </Badge>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <Euro className="h-4.5 w-4.5 text-emerald-600" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600/70">
            Price
          </p>
          <p className="mt-0.5 text-lg font-bold text-emerald-700">
            {priceAmount} {currency}
          </p>
        </div>
      </div>
    </div>
  );
}
