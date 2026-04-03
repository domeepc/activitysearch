import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, MapPin, Users } from "lucide-react";
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {address ? (
        <div className="flex items-start gap-3 rounded-lg border-2 border-border p-4">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Address</p>
            <p className="text-sm text-muted-foreground">{address}</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-lg border-2 border-border p-4">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Duration</p>
          <p className="text-sm text-muted-foreground">{durationLabel}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border-2 border-border p-4">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Difficulty</p>
          <Badge
            variant="secondary"
            className="mt-1 capitalize"
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

      <div className="flex items-start gap-3 rounded-lg border-2 border-border p-4">
        <DollarSign className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Price</p>
          <p className="text-sm font-semibold text-green-600">
            {priceAmount} {currency}
          </p>
        </div>
      </div>
    </div>
  );
}
