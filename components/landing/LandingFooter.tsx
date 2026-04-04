import Link from "next/link";

const linkClass =
  "font-medium text-zinc-800 underline-offset-4 hover:underline";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-white py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <p>© {year} ActivitySearch. All rights reserved.</p>
          <nav
            className="flex flex-wrap gap-x-4 gap-y-1"
            aria-label="Legal"
          >
            <Link href="/terms" className={linkClass}>
              Terms of Service
            </Link>
            <Link href="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
          </nav>
        </div>
        <p>
          Support:{" "}
          <a href="mailto:domagoj.milardovic@activitysearch.eu" className={linkClass}>
            domagoj.milardovic@activitysearch.eu
          </a>
        </p>
      </div>
    </footer>
  );
}
