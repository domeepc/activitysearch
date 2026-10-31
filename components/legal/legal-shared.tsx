import type { ReactNode } from "react";

export const LEGAL_SUPPORT_EMAIL = "domemdev+activitysearch@gmail.com";

export interface LegalSectionData {
  /** Anchor for the table of contents, e.g. "payments" → /terms#payments */
  id: string;
  title: string;
  content: ReactNode;
}

export function SupportEmailLink() {
  return (
    <a
      href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
      className="font-medium text-blue-700 underline underline-offset-4 hover:text-blue-600 dark:text-blue-400"
    >
      {LEGAL_SUPPORT_EMAIL}
    </a>
  );
}
