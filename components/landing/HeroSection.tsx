import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HeroSection() {
  return (
    <section
      className="flex min-h-[85vh] w-full flex-col items-center justify-center px-4 pt-16"
      style={{
        backgroundImage:
          "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <Badge className="mb-6 rounded-full bg-blue-600 px-3 py-1 text-xs tracking-wide text-white">
          EASY TO EXPERIENCE
        </Badge>
        <h1 className="text-6xl font-bold leading-none tracking-tight text-zinc-900 md:text-8xl">
          Find activities{" "}
          <span className="text-blue-600">near you.</span>
        </h1>
        <p className="mt-6 max-w-lg text-base text-zinc-500">
          Discover sports and local activities, compare options, and book your
          next experience in a few taps.
        </p>
        <form
          action="/home"
          method="GET"
          className="mt-8 w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-md"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              name="q"
              placeholder="What are you looking for?"
              className="h-11 rounded-xl border-zinc-200"
            />
            <Button type="submit" className="h-11 rounded-xl px-6">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </form>
        <p className="mt-6 text-sm text-zinc-400">
          ★ 4.9 · 2,000+ activities · Trusted by local communities
        </p>
      </div>
    </section>
  );
}
