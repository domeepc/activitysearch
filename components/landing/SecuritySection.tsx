import { Lock } from "lucide-react";
import { Accent } from "./SectionHeading";

const points = [
  {
    title: "End-to-end encrypted chat",
    description: "Team and direct messages are encrypted on your device — only participants can read them.",
  },
  {
    title: "Built for trust",
    description: "Industry-standard protocols and careful handling of your account data at every step.",
  },
  {
    title: "You stay in control",
    description: "Sensitive coordination stays private — share details only with people you choose.",
  },
];

export function SecuritySection() {
  return (
    <section
      aria-labelledby="security-h"
      className="flex h-full flex-col gap-6 rounded-[28px] border border-zinc-800 bg-zinc-900 p-6 md:p-9"
    >
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-blue-400">04 — Security &amp; privacy</p>
      <h2 id="security-h" className="text-[clamp(2.1rem,4vw,3.5rem)] font-extrabold leading-none tracking-[-0.04em] text-zinc-50">
        Your conversations, <Accent>yours only</Accent>.
      </h2>
      <div aria-hidden="true" className="flex min-w-0 max-w-sm flex-col gap-2 self-start rounded-[18px] border border-zinc-800 bg-zinc-950 p-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
          <Lock className="size-3" /> End-to-end encrypted
        </span>
        <span className="self-start rounded-[14px] rounded-bl-[4px] bg-zinc-800 px-3 py-2 text-sm text-zinc-50">
          Meet at the marina at 17:45?
        </span>
        <span className="self-end rounded-[14px] rounded-br-[4px] bg-blue-600 px-3 py-2 text-sm text-white">On my way</span>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {points.map(({ title, description }) => (
          <div key={title}>
            <h3 className="text-[15px] font-semibold text-zinc-50">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
