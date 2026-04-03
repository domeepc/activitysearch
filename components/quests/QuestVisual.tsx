"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { DEFAULT_QUEST_ICON_SVG } from "@/lib/questDefaults";

const imageFrameClass = {
  sm: "size-6",
  md: "size-9",
  lg: "size-12",
  xl: "size-24 rounded-xl",
} as const;

/** System / default SVG icons: outer box with generous inset so the glyph breathes. */
const svgFrameClass = {
  sm: "inline-flex size-8 items-center justify-center p-1.5 [&>svg]:size-5 [&>svg]:shrink-0",
  md: "inline-flex size-11 items-center justify-center p-2 [&>svg]:size-7 [&>svg]:shrink-0",
  lg: "inline-flex size-14 items-center justify-center p-2.5 [&>svg]:size-9 [&>svg]:shrink-0",
  xl: "inline-flex size-28 items-center justify-center p-4 [&>svg]:size-20 [&>svg]:shrink-0 rounded-xl",
} as const;

export type QuestVisualSize = keyof typeof imageFrameClass;

export function QuestVisual({
  iconImageUrl,
  iconSvg,
  className,
  size = "md",
}: {
  iconImageUrl?: string | null;
  iconSvg?: string | null;
  className?: string;
  size?: QuestVisualSize;
}) {
  const url = iconImageUrl?.trim();
  if (url) {
    const imageSizes =
      size === "sm"
        ? "24px"
        : size === "md"
          ? "36px"
          : size === "lg"
            ? "48px"
            : "96px";
    return (
      <span
        className={cn(
          "relative inline-block shrink-0 overflow-hidden rounded-md bg-muted",
          imageFrameClass[size],
          className
        )}
      >
        <Image
          src={url}
          alt=""
          fill
          className="object-cover"
          sizes={imageSizes}
        />
      </span>
    );
  }
  const raw = iconSvg?.trim() || DEFAULT_QUEST_ICON_SVG;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-muted text-primary ring-1 ring-border/60",
        svgFrameClass[size],
        className
      )}
      dangerouslySetInnerHTML={{ __html: raw }}
      aria-hidden
    />
  );
}
