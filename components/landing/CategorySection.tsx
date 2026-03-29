import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { categories } from "@/components/landing/data";
import { Button } from "@/components/ui/button";

interface CategorySectionProps {
  items?: typeof categories;
}

export function CategorySection({ items }: CategorySectionProps) {
  const displayCategories = items && items.length >= 4 ? items : categories;

  return (
    <section className="bg-zinc-50 py-14">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 md:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Explore by Category
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Browse experiences by vibe and energy level.
            </p>
          </div>
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/home">
              Explore all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <article className="group relative min-h-[260px] overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-900 to-zinc-700 p-6 text-white shadow-sm md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">
              Featured
            </p>
            <h3 className="mt-2 text-3xl font-semibold">{displayCategories[0].title}</h3>
            <p className="mt-1 text-sm text-white/75">{displayCategories[0].subtitle}</p>
          </article>
          <div className="grid gap-3">
            {displayCategories.slice(1).map((category) => (
              <article
                key={category.title}
                className={`min-h-[120px] rounded-2xl border border-zinc-200 bg-gradient-to-br ${category.tone} p-4 text-white shadow-sm`}
              >
                <h4 className="text-base font-semibold">{category.title}</h4>
                <p className="text-xs text-white/80">{category.subtitle}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
