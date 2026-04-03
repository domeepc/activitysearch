import Link from "next/link";
import { Search } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { heroCards, HeroCardItem } from "@/components/landing/data";

interface HeroSectionProps {
  cards?: HeroCardItem[];
}

export function HeroSection({ cards }: HeroSectionProps) {
  const displayCards = cards && cards.length > 0 ? cards : heroCards;

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-14 pt-4 md:grid-cols-2 md:px-6 md:pt-8">
      <div className="space-y-6">
        <Badge className="rounded-full bg-blue-600 px-3 py-1 text-xs tracking-wide text-white">
          EASY TO EXPERIENCE
        </Badge>
        <div className="space-y-4">
          <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-zinc-900 md:text-6xl">
            Find activities <span className="text-blue-600">near you.</span>
          </h1>
          <p className="max-w-lg text-sm text-zinc-600 md:text-base">
            Discover sports and local activities, compare options, and book your
            next experience in a few taps.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="What are you looking for?"
              className="h-11 rounded-xl border-zinc-200"
            />
            <Button asChild className="h-11 rounded-xl px-6">
              <Link href="/home">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <div className="relative col-span-2 h-28 overflow-hidden rounded-2xl bg-linear-to-r from-blue-100 to-cyan-100" />
        {displayCards.map((card) => (
          <article
            key={card.title}
            className={`relative min-h-[220px] overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br ${card.tone} p-4 text-white shadow-sm`}
          >
            {card.imageUrl ? (
              <Image
                src={card.imageUrl}
                alt={card.title}
                loading="eager"
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            ) : null}
            <div className="absolute inset-0 z-10 bg-linear-to-t from-black/45 via-black/20 to-transparent" />
            <div className="absolute inset-0 z-20 opacity-20 [background:radial-gradient(circle_at_top_right,white_0%,transparent_45%)]" />
            <Badge
              variant="secondary"
              className="relative z-30 mb-3 border-0 bg-white/90 text-[10px] font-semibold text-zinc-800"
            >
              {card.badge}
            </Badge>
            <div className="relative z-30 mt-auto space-y-1 pt-20">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="text-sm text-white/85">{card.subtitle}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
