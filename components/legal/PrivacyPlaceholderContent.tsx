import { LegalSection, LEGAL_SUPPORT_EMAIL } from "./legal-shared";

export function PrivacyPlaceholderContent() {
  const placeholder =
    "Final legal language for this section is not yet published. This outline is a placeholder until counsel-approved privacy information is added.";

  return (
    <>
      <LegalSection title="Introduction">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Data we collect">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="How we use your data">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="How we share data">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Retention">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Your rights">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Cookies and similar technologies">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Third-party services">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          For privacy-related questions while the final policy is in
          preparation, contact{" "}
          <a
            href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
            className="font-medium text-zinc-800 underline-offset-4 hover:underline"
          >
            {LEGAL_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </>
  );
}
