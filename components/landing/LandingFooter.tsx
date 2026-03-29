export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-white py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between md:px-6">
        <p>© {year} ActivitySearch. All rights reserved.</p>
        <p>
          Support:{" "}
          <a
            href="mailto:domagoj.milardovic@activitysearch.eu"
            className="font-medium text-zinc-800 underline-offset-4 hover:underline"
          >
            domagoj.milardovic@activitysearch.eu
          </a>
        </p>
      </div>
    </footer>
  );
}
