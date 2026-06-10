import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { categories, type CategoryItem } from "@/components/landing/data";

interface CategorySectionProps {
  items?: CategoryItem[];
}

function CategoryTile({ category, paddingClass }: { category: CategoryItem; paddingClass: string }) {
  const hasImage = Boolean(category.imageUrl);

  return (
    <article className="group relative min-h-[120px] overflow-hidden rounded-2xl border border-zinc-200 text-white shadow-sm">
      {hasImage ? (
        <>
          <Image
            src={category.imageUrl!}
            alt={category.title}
            fill
            loading="eager"
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/40 to-black/25" />
        </>
      ) : (
        <div
          className={`absolute inset-0 bg-linear-to-br ${category.tone}`}
          aria-hidden
        />
      )}
      <div className={`relative z-10 flex h-full flex-col justify-end ${paddingClass}`}>
        <h4 className="text-base font-semibold">{category.title}</h4>
        <p className="mt-1 text-xs text-white/80">{category.subtitle}</p>
      </div>
    </article>
  );
}

export function CategorySection({ items }: CategorySectionProps) {
  const displayCategories = items && items.length >= 4 ? items : categories;
  const featured = displayCategories[0];
  const rest = displayCategories.slice(1);

  return (
    <section className="bg-white py-14">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 md:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="border-l-4 border-blue-600 pl-4">
              <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
                Explore by Category
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Browse experiences by vibe and energy level.
              </p>
            </div>
          </div>
          <Link
            href="/home"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Explore all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <article className="group relative min-h-[320px] overflow-hidden rounded-2xl border border-zinc-200 shadow-sm md:col-span-2">
            {featured.imageUrl ? (
              <>
                <Image
                  src={featured.imageUrl}
                  alt=""
                  fill
                  loading="eager"
                  sizes="(max-width: 768px) 100vw, 66vw"
                  className="object-cover transition duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/45 to-black/30" />
              </>
            ) : (
              <div
                className={`absolute inset-0 bg-linear-to-br ${featured.tone}`}
                aria-hidden
              />
            )}
            <div className="relative z-10 flex h-full flex-col justify-end p-6 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                Featured
              </p>
              <h3 className="mt-2 text-3xl font-semibold">{featured.title}</h3>
              <p className="mt-1 text-sm text-white/75">{featured.subtitle}</p>
            </div>
          </article>
          <div className="grid gap-3">
            {rest.map((category) => (
              <CategoryTile
                key={category.title}
                category={category}
                paddingClass="p-4"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
