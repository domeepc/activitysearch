import { Lock, ShieldCheck, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const highlights = [
  {
    icon: MessageSquare,
    title: "End-to-end encrypted chat",
    description:
      "Team and direct messages are encrypted on your device so only participants can read them.",
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
      "Sensitive coordination stays private—share details only with people you choose.",
  },
] as const;

export function SecuritySection() {
  return (
    <section className="bg-zinc-50 py-14">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 md:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Security & privacy
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            Your conversations, protected
          </h2>
          <p className="mt-2 text-sm text-zinc-600 md:text-base">
            We take messaging seriously. Chat is protected with end-to-end
            encryption so your plans and personal updates stay between you and
            your group—not in the clear on our servers.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="border-zinc-200 bg-white shadow-sm"
            >
              <CardContent className="space-y-3 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-semibold text-zinc-900">{title}</h3>
                <p className="text-sm text-zinc-600">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
