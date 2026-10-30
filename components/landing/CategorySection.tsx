import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categories, CategoryItem } from "@/components/landing/data";
import { Accent, SectionHeading } from "./SectionHeading";

interface CategorySectionProps {
  items?: CategoryItem[];
}

export function CategorySection({ items }: CategorySectionProps) {
  const displayItems = items && items.length > 0 ? items : categories;

  return (
    <section id="explore" aria-labelledby="explore-h" className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-4 pt-28 md:px-10">
      <SectionHeading
        id="explore-h"
        index="01"
        eyebrow="Explore"
        title={<>Pick a <Accent>vibe</Accent>.</>}
        description="Browse experiences by vibe and energy level."
        action={
          <Link
            href="/sign-up"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-zinc-700 px-5 text-sm text-zinc-50 transition-colors hover:border-zinc-500"
          >
            Explore all <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      />
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {displayItems.map((category, i) => (
          <Link
            key={category.title}
            href="/sign-up"
            className="group relative flex h-72 flex-col justify-between overflow-hidden rounded-[22px] bg-zinc-900 p-5 text-zinc-50 md:h-96"
          >
            {category.imageUrl ? (
              <Image
                src={category.imageUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
              />
            ) : null}
            {/* Scrim keeps white text legible over any photo */}
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
            <span className="relative text-[13px] text-zinc-300">0{i + 1}</span>
            <span className="relative flex flex-col gap-1.5">
              <span className="text-[30px] font-bold leading-none tracking-[-0.03em]">{category.title}</span>
              <span className="text-sm text-zinc-300">{category.subtitle}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
