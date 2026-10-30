import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { Accent } from "./SectionHeading";

const MARQUEE = [
  "Water Sports",
  "Hiking & Trekking",
  "Cycling",
  "Food & Wine",
  "Adventure Sports",
  "Mindful Flow",
  "Team Sports",
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 md:pt-36">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-10">
        <p className="flex items-center gap-2.5 text-[13px] text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          Live map of activities near you
        </p>
        <h1 className="mt-7 text-[clamp(4rem,11vw,10.5rem)] font-extrabold leading-[0.9] tracking-[-0.055em] text-zinc-50">
          Find your
          <br />
          <Accent className="text-blue-400">next</Accent> weekend.
        </h1>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
          <p className="max-w-md text-lg leading-relaxed text-zinc-300">
            Discover sports and local activities, bring your team, split the bill
            and earn XP for every adventure.
          </p>
          <form
            action="/sign-in"
            method="GET"
            className="flex w-full max-w-xl gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 p-1.5"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2.5 pl-4 text-zinc-400">
              <Search className="size-[18px] shrink-0" aria-hidden="true" />
              <span className="sr-only">Search activities</span>
              <input
                name="q"
                type="search"
                placeholder="Kayaking, padel, hiking…"
                className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-zinc-50 placeholder:text-zinc-500 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="h-12 shrink-0 whitespace-nowrap rounded-full bg-blue-600 px-4 text-[15px] font-semibold text-white transition hover:bg-blue-500 active:scale-[0.97] sm:px-6"
            >
              Explore map
            </button>
          </form>
        </div>
      </div>

      <div
        aria-label="Featured activities"
        role="group"
        className="mx-auto mt-12 grid w-full max-w-[1440px] grid-cols-2 items-end gap-3 px-4 md:grid-cols-12 md:px-10"
      >
        <HeroTile src="/images/outdoor-pursuit.jpg" label="Outdoor Pursuit" className="h-56 md:col-span-4 md:h-[300px]" />
        <HeroTile src="/images/team_sports.jpg" label="Team Sports" className="h-44 md:col-span-3 md:h-[220px]" />
        <HeroTile src="/images/high-energy.jpg" label="High Energy" className="hidden md:col-span-2 md:block md:h-[260px]" />
        <Link
          href="/sign-in"
          className="col-span-2 flex h-56 flex-col justify-end gap-2 rounded-[22px] bg-violet-950 p-5 transition-transform hover:-translate-y-1 md:col-span-3 md:h-[320px]"
        >
          <span className="text-xs uppercase tracking-[0.08em] text-violet-200">Quest</span>
          <span className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-zinc-50">
            Try two different categories in one weekend
          </span>
          <span className="text-sm text-amber-200">Weekend explorer badge</span>
        </Link>
      </div>

      <div aria-hidden="true" className="mt-10 overflow-hidden whitespace-nowrap border-y border-zinc-800">
        <div className="inline-flex gap-12 py-[18px] text-[22px] font-semibold tracking-[-0.02em] text-zinc-500 motion-safe:animate-marquee">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-12">
              {item}
              <span className="text-blue-600">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroTile({ src, label, className }: { src: string; label: string; className?: string }) {
  return (
    <div className={`group relative overflow-hidden rounded-[22px] bg-zinc-900 ${className ?? ""}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 768px) 33vw, 50vw"
        className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
        priority
      />
      <span className="absolute bottom-4 left-4 rounded-full bg-zinc-950/70 px-3 py-2 text-[13px] text-zinc-50 backdrop-blur">
        {label}
      </span>
    </div>
  );
}
