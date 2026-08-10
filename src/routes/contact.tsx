import { createFileRoute } from "@tanstack/react-router";
import {
  PolicyPage,
  PolicySection,
  policyContact,
} from "~/components/PolicyPage";

export const Route = createFileRoute("/contact")({ component: ContactPage });

function ContactPage() {
  return (
    <PolicyPage
      title="Contact & Data Requests"
      updated="9 August 2026"
      intro="Use the contact below for platform questions, privacy requests, policy concerns, or to stop future communications from LOGISTIQS INTELLIGENCE."
    >
      <PolicySection title="Contact LOGISTIQS">
        {policyContact}
        <p>
          Include enough detail for us to understand your request, but do not
          send passwords, API keys, payment credentials, or unnecessary
          sensitive information by email.
        </p>
      </PolicySection>
      <PolicySection title="Data requests">
        <p>
          You may ask about access, correction, deletion, or restriction of
          personal information, subject to applicable law and records we are
          required to retain. We may need to verify your identity and authority
          before completing a request.
        </p>
      </PolicySection>
      <PolicySection title="Unsubscribe and suppression">
        <p>
          To stop non-essential communications, write “unsubscribe” in your
          message. We will add the relevant address to a suppression record and
          will not use it for future promotional outreach, except where a
          service or legal message is necessary.
        </p>
      </PolicySection>
      <PolicySection title="Safety and disputes">
        <p>
          For an urgent transport, safety, or cargo issue, contact the relevant
          shipper or carrier directly as well as LOGISTIQS. The marketplace does
          not replace emergency services, insurers, regulators, or the parties’
          transport agreement.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
