"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Photo({ src, alt, priority, sizes, contain }: { src: string; alt: string; priority?: boolean; sizes: string; contain?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="size-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true" />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={contain ? "object-contain" : "object-cover"}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/** Scroll-snap carousel: swipe on touch, arrows and keys on desktop. */
function useSnapCarousel(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback(
    (i: number, smooth = true) => {
      const el = ref.current;
      if (!el) return;
      const next = (i + count) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
    },
    [count]
  );

  const onScroll = () => {
    const el = ref.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return { ref, index, goTo, onScroll };
}

function Arrows({ onPrev, onNext, dark }: { onPrev: () => void; onNext: () => void; dark?: boolean }) {
  const btn = cn(
    "absolute top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-sm backdrop-blur transition-colors",
    dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/90 text-zinc-900 hover:bg-white"
  );
  return (
    <>
      <button type="button" aria-label="Previous photo" onClick={onPrev} className={cn(btn, "left-3")}>
        <ChevronLeft className="size-5" />
      </button>
      <button type="button" aria-label="Next photo" onClick={onNext} className={cn(btn, "right-3")}>
        <ChevronRight className="size-5" />
      </button>
    </>
  );
}

interface ActivityDetailGalleryProps {
  images: string[];
  title: string;
}

export function ActivityDetailGallery({ images, title }: ActivityDetailGalleryProps) {
  const count = images.length;
  const { ref: heroRef, index: heroIndex, goTo: heroGo, onScroll: heroScroll } = useSnapCarousel(count);
  const { ref: boxRef, index: boxIndex, goTo: boxGo, onScroll: boxScroll } = useSnapCarousel(count);
  const [open, setOpen] = useState(false);

  // Open the lightbox on the photo the hero is showing.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => boxGo(heroIndex, false));
    return () => cancelAnimationFrame(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (count === 0) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-3xl bg-gradient-to-br from-blue-100 to-cyan-50 text-sm text-zinc-500 md:h-72 dark:from-zinc-800 dark:to-zinc-900">
        No photos yet
      </div>
    );
  }

  const keyNav = (goTo: (i: number) => void, index: number) => (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-roledescription="carousel"
        aria-label={`Photos of ${title}`}
        className="group relative overflow-hidden rounded-3xl bg-zinc-100 dark:bg-zinc-900"
      >
        <div
          ref={heroRef}
          onScroll={heroScroll}
          onKeyDown={keyNav(heroGo, heroIndex)}
          tabIndex={0}
          className="flex h-64 snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] sm:h-80 md:h-[420px] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Photo ${i + 1} of ${count} — open full screen`}
              aria-roledescription="slide"
              className="relative h-full w-full shrink-0 snap-center"
            >
              <Photo src={src} alt={i === 0 ? title : ""} priority={i === 0} sizes="(min-width: 1152px) 1104px, 100vw" />
            </button>
          ))}
        </div>

        {count > 1 && (
          <div className="opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <Arrows onPrev={() => heroGo(heroIndex - 1)} onNext={() => heroGo(heroIndex + 1)} />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
          {count > 1 ? (
            <div className="pointer-events-auto flex gap-1 rounded-full bg-black/35 px-2 py-2 backdrop-blur">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to photo ${i + 1}`}
                  aria-current={i === heroIndex}
                  onClick={() => heroGo(i)}
                  className={cn("h-2 rounded-full bg-white transition-all", i === heroIndex ? "w-5" : "w-2 opacity-60 hover:opacity-90")}
                />
              ))}
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-xl bg-white/95 px-3 text-sm font-semibold text-zinc-900 shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            <Expand className="size-4" />
            {count > 1 ? `${heroIndex + 1} / ${count}` : "View"}
          </button>
        </div>
      </section>

      {count > 1 && (
        <div className="-m-1 hidden gap-2 overflow-x-auto p-1 md:flex [scrollbar-width:thin]" role="group" aria-label="Choose photo">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => heroGo(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === heroIndex}
              className={cn(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl transition-all after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:z-10 after:ring-2 after:ring-inset",
                i === heroIndex ? "after:ring-blue-600" : "opacity-70 after:ring-transparent hover:opacity-100"
              )}
            >
              <Photo src={src} alt="" sizes="96px" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-1rem)] gap-3 bg-zinc-950 p-3 text-white sm:max-w-5xl dark:bg-zinc-950">
          <DialogTitle className="px-1 text-base text-white">
            {title} · {count > 1 ? `${boxIndex + 1} / ${count}` : "1 photo"}
          </DialogTitle>
          <div className="relative overflow-hidden rounded-xl">
            <div
              ref={boxRef}
              onScroll={boxScroll}
              onKeyDown={keyNav(boxGo, boxIndex)}
              tabIndex={0}
              className="flex snap-x snap-mandatory overflow-x-auto outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {images.map((src, i) => (
                <div key={src} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-zinc-900">
                  <Photo src={src} alt={`${title} — photo ${i + 1}`} sizes="(min-width: 1024px) 1000px, 100vw" contain />
                </div>
              ))}
            </div>
            {count > 1 && <Arrows dark onPrev={() => boxGo(boxIndex - 1)} onNext={() => boxGo(boxIndex + 1)} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
