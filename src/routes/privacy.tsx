import { createFileRoute } from "@tanstack/react-router";
import {
  PolicyPage,
  PolicySection,
  policyContact,
} from "~/components/PolicyPage";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      updated="9 August 2026"
      intro="This policy explains how LOGISTIQS INTELLIGENCE handles information when you use our website and freight marketplace."
    >
      <PolicySection title="Information we collect">
        <p>
          We may collect account details, company information, load and route
          details, communications, device information, and usage data needed to
          operate and secure the service.
        </p>
        <p>
          Please do not submit sensitive personal information that is not needed
          for a shipment or account.
        </p>
      </PolicySection>
      <PolicySection title="How we use information">
        <p>
          We use information to create accounts, publish and match loads,
          support shipment visibility, communicate about the service, prevent
          abuse, and improve reliability. We do not sell personal information.
        </p>
      </PolicySection>
      <PolicySection title="Sharing and retention">
        <p>
          Information may be shared with the other marketplace participants
          needed for a transaction, service providers operating the platform,
          and authorities where legally required. We retain information only as
          long as reasonably needed for these purposes, legal obligations, and
          dispute handling.
        </p>
      </PolicySection>
      <PolicySection title="Security and your choices">
        <p>
          We use reasonable safeguards, but no online service can promise
          absolute security. You may request access, correction, deletion, or
          clarification about your information, subject to applicable law and
          legitimate records we must retain.
        </p>
        {policyContact}
      </PolicySection>
      <PolicySection title="Cookies and changes">
        <p>
          We may use essential cookies or similar technologies for sessions,
          security, and preferences. We may update this policy as the service
          develops and will post the revised date here.
        </p>
      </PolicySection>
      <PolicySection title="Important notice">
        <p>
          This is general platform information, not jurisdiction-specific legal
          advice. Please obtain local legal review before relying on it for a
          particular operation or country.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
