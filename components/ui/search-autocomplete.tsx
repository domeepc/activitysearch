"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, Search, Star, X } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { ActivityData } from "@/lib/types/activity";

interface SearchAutocompleteProps {
  activities: ActivityData[];
  onActivitySelect: (activity: ActivityData) => void;
  onClearSelection?: () => void;
  placeholder?: string;
  className?: string;
}

interface SearchResult {
  activity: ActivityData;
  /** Which field matched, so the row can highlight it. */
  field: "title" | "location";
}

function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-blue-100 px-px text-inherit dark:bg-blue-900/60">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export default function SearchAutocomplete({
  activities,
  onActivitySelect,
  onClearSelection,
  placeholder = "Search activity or location…",
  className = "",
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const term = query.trim();

  const results = useMemo<SearchResult[]>(() => {
    if (!term) return [];
    const q = term.toLowerCase();
    const titleHits: SearchResult[] = [];
    const placeHits: SearchResult[] = [];
    for (const activity of activities) {
      if (activity.title.toLowerCase().includes(q)) titleHits.push({ activity, field: "title" });
      else if (
        activity.location.name.toLowerCase().includes(q) ||
        activity.location.address.toLowerCase().includes(q)
      )
        placeHits.push({ activity, field: "location" });
    }
    // Title matches first: they're what people usually type.
    return [...titleHits, ...placeHits].slice(0, 8);
  }, [term, activities]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const select = (activity: ActivityData) => {
    setQuery(activity.title);
    setOpen(false);
    onActivitySelect(activity);
  };

  const clear = () => {
    setQuery("");
    setOpen(false);
    onClearSelection?.();
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) select(results[open ? active : 0].activity);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else if (query) clear();
    }
  };

  const showList = open && term.length > 0;

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        aria-label="Search activities"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          onClearSelection?.();
        }}
        onFocus={() => term && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-transparent bg-zinc-100 pl-10 pr-10 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-300 focus:bg-white focus:ring-[3px] focus:ring-blue-600/15 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
      />
      {query && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
        >
          <X className="size-4" />
        </button>
      )}

      {showList && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_16px_40px_-16px_rgba(0,0,0,0.3)] animate-in fade-in-0 slide-in-from-top-1 duration-150 dark:border-zinc-700 dark:bg-zinc-900">
          {results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
              No activities match “{term}”
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Activities" className="max-h-80 overflow-y-auto p-1.5">
              {results.map(({ activity, field }, i) => {
                const image = activity.images?.[0];
                return (
                  <li
                    key={activity.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => select(activity)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2",
                      i === active && "bg-zinc-100 dark:bg-zinc-800"
                    )}
                  >
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-[10px] bg-blue-100 dark:bg-zinc-800">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="size-full object-cover" />
                      ) : (
                        <MapPin className="absolute inset-0 m-auto size-4 text-blue-600" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        <Highlight text={activity.title} query={field === "title" ? term : ""} />
                      </b>
                      <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">
                        <Highlight
                          text={activity.location.address || activity.location.name || "No address"}
                          query={field === "location" ? term : ""}
                        />
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
                      <b className="text-zinc-900 dark:text-zinc-50">{formatPrice(activity.price.amount)}</b>
                      {activity.reviewCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-zinc-600 dark:text-zinc-400">
                          <Star className="size-3 fill-amber-500 text-amber-500" aria-hidden="true" />
                          {activity.rating.toFixed(1)}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
