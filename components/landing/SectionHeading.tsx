import { ReactNode } from "react";

/** Numbered eyebrow + oversized headline used by every landing section. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  action,
  id,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="min-w-[280px] flex-1">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-blue-400">
          {index} — {eyebrow}
        </p>
        <h2
          id={id}
          className="mt-2.5 text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.045em] text-zinc-50"
        >
          {title}
        </h2>
      </div>
      {description ? (
        <p className="max-w-xs text-base leading-relaxed text-zinc-400">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function Accent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-display font-normal italic tracking-[-0.03em] ${className ?? ""}`}>
      {children}
    </span>
  );
}
