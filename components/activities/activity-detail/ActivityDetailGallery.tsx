"use client";

import { useState } from "react";
import Image from "next/image";
import { Images } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Photo({ src, alt, priority, sizes }: { src: string; alt: string; priority?: boolean; sizes: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="size-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true" />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover transition-transform duration-500 ease-out group-hover/photo:scale-[1.03]"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

interface ActivityDetailGalleryProps {
  images: string[];
  title: string;
}

/** Photo mosaic: one big photo plus up to two side tiles; tap any to see all. */
export function ActivityDetailGallery({ images, title }: ActivityDetailGalleryProps) {
  const [open, setOpen] = useState(false);

  if (images.length === 0) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-[22px] bg-gradient-to-br from-blue-100 to-cyan-50 text-sm text-zinc-500 md:h-72 dark:from-zinc-800 dark:to-zinc-900">
        No photos yet
      </div>
    );
  }

  const side = images.slice(1, 3);

  return (
    <>
      <div
        className={cn(
          "relative grid h-64 gap-2 overflow-hidden rounded-[22px] sm:h-80 md:h-[420px]",
          side.length > 0 && "sm:grid-cols-[2fr_1fr]"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group/photo relative overflow-hidden outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`Open photos of ${title}`}
        >
          <Photo src={images[0]} alt={title} priority sizes="(min-width: 640px) 66vw, 100vw" />
        </button>
        {side.length > 0 && (
          <div className={cn("hidden gap-2 sm:grid", side.length === 2 && "grid-rows-2")}>
            {side.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setOpen(true)}
                className="group/photo relative overflow-hidden outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={`Open photo ${i + 2} of ${images.length}`}
              >
                <Photo src={src} alt="" sizes="33vw" />
              </button>
            ))}
          </div>
        )}
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute right-3 bottom-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/95 px-3 text-sm font-semibold text-zinc-900 shadow-sm backdrop-blur transition-colors hover:bg-white"
          >
            <Images className="size-4" />
            All {images.length} photos
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-1rem)] gap-3 bg-zinc-950 p-3 text-white sm:max-w-4xl dark:bg-zinc-950">
          <DialogTitle className="px-1 text-base text-white">
            {title} · {images.length} {images.length === 1 ? "photo" : "photos"}
          </DialogTitle>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-xl [scrollbar-width:thin]">
            {images.map((src, i) => (
              <div key={src} className="relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden rounded-xl bg-zinc-900">
                <Image src={src} alt={`${title} — photo ${i + 1}`} fill sizes="(min-width: 896px) 880px, 100vw" className="object-contain" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
