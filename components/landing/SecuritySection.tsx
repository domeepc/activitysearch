import { Lock, ShieldCheck, MessageSquare } from "lucide-react";

const highlights = [
  {
    icon: MessageSquare,
    title: "End-to-end encrypted chat",
    description:
      "Team and direct messages are encrypted on your device — only participants can read them.",
  },
  {
    icon: ShieldCheck,
    title: "Built for trust",
    description:
      "Industry-standard protocols and careful handling of your account data at every step.",
  },
  {
    icon: Lock,
    title: "You stay in control",
    description:
      "Sensitive coordination stays private — share details only with people you choose.",
  },
] as const;

export function SecuritySection() {
  return (
    <section className="bg-zinc-900 py-20">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16 md:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
              Security & Privacy
            </p>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              Your conversations,
              <br />
              protected.
            </h2>
            <p className="max-w-sm text-sm text-zinc-400 md:text-base">
              We take messaging seriously. Chat is protected with end-to-end
              encryption so your plans stay between you and your group.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <Lock className="h-3.5 w-3.5 text-blue-400" aria-hidden />
              <span className="text-xs font-medium text-zinc-300">
                End-to-end encrypted
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-7">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/20">
                  <Icon className="h-5 w-5 text-blue-400" aria-hidden />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
