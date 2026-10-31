import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { ActivityItem, topRated } from "@/components/landing/data";
import { Accent, SectionHeading } from "./SectionHeading";

interface TopRatedSectionProps {
  items?: ActivityItem[];
}

export function TopRatedSection({ items }: TopRatedSectionProps) {
  const [featured, ...rest] = items && items.length > 0 ? items : topRated;

  return (
    <section aria-labelledby="top-h" className="mx-auto w-full max-w-[1440px] px-4 pt-28 md:px-10">
      <SectionHeading
        id="top-h"
        index="02"
        eyebrow="Top rated"
        title={<>Loved by the <Accent>community</Accent>.</>}
        description="Popular experiences trusted by the community."
      />
      <div className="mt-7 grid gap-3 md:grid-cols-12">
        <Link
          href="/sign-in"
          className="group relative flex h-[420px] flex-col justify-between overflow-hidden rounded-3xl bg-zinc-900 p-6 md:col-span-6 md:h-[460px]"
        >
          {featured.imageUrl ? (
            <Image
              src={featured.imageUrl}
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
            />
          ) : null}
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <span className="relative self-start rounded-full bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-950">
            Featured
          </span>
          <span className="relative flex flex-wrap items-end justify-between gap-4">
            <span>
              <span className="block text-[13px] text-zinc-300">{featured.category} · Nearby</span>
              <span className="block text-[40px] font-bold leading-[1.05] tracking-[-0.035em] text-zinc-50">
                {featured.title}
              </span>
            </span>
            <span className="flex gap-2 text-sm text-zinc-50">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950/70 px-4 py-3 backdrop-blur">
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                {featured.rating}
              </span>
              <span className="rounded-full bg-blue-600 px-4 py-3 font-semibold">{featured.price}</span>
            </span>
          </span>
        </Link>

        {rest.map((activity) => (
          <Link
            key={activity.title}
            href="/sign-in"
            className="group flex h-[420px] flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700 md:col-span-3 md:h-[460px]"
          >
            <span className="relative flex-1 overflow-hidden bg-zinc-800">
              {activity.imageUrl ? (
                <Image
                  src={activity.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 25vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
                />
              ) : null}
            </span>
            <span className="flex flex-col gap-2 p-4">
              <span className="text-[13px] text-zinc-400">{activity.category} · Nearby</span>
              <span className="text-xl font-bold tracking-[-0.02em] text-zinc-50">{activity.title}</span>
              <span className="mt-2 flex justify-between text-sm text-zinc-50">
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {activity.rating}
                </span>
                <b>{activity.price}</b>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
