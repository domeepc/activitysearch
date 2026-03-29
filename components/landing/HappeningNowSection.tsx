import { Clock3 } from "lucide-react";
import { happeningNow, LiveItem } from "@/components/landing/data";
import { Badge } from "@/components/ui/badge";

interface HappeningNowSectionProps {
  items?: LiveItem[];
}

export function HappeningNowSection({ items }: HappeningNowSectionProps) {
  const displayItems = items && items.length > 0 ? items : happeningNow;

  return (
    <section className="border-y border-zinc-200 bg-zinc-50 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 md:flex-row md:items-center md:px-6">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Clock3 className="h-4 w-4 text-blue-600" />
          Happening Right Now
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {displayItems.map((item) => (
            <Badge
              key={item.label}
              variant="secondary"
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 shadow-sm"
            >
              {item.label}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
