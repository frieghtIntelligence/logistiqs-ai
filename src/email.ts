// Server-only Resend email transport for LOGISTIQS INTELLIGENCE.
//
// This module is a clean replacement for the original src/email.ts, which was
// lost (untracked, never committed). It is a *transport only*: it defines how
// to send an email through Resend and how to verify Resend webhook signatures.
// It is deliberately NOT wired into any outreach campaign or freight event —
// callers opt in when a feature is built that needs email.
//
// SERVER-ONLY: never import this file from client code. It reads
// process.env at call time and performs network I/O. Like auth.server.ts, any
// future client-facing server function must import it dynamically.
//
// Configuration (read from the environment at runtime; never hard-coded):
//   - RESEND_API_KEY       required to send (a `re_` key from Resend).
//   - RESEND_EMAIL_FROM    default sender, e.g. "Logistiqs <logistiqs@logistiqs.live>".
//   - RESEND_WEBHOOK_SECRET  required to verify inbound webhook signatures
//                           (Resend's `whsec_` signing secret).
//   - RESEND_DISABLE_DELIVERY  optional kill-switch: "1" | "true" | "yes".
//   - NODE_ENV === "test"  also blocks delivery.
//
// Guarantees:
//   - Returns { status: "not_configured" } without any network call when the
//     API key or sender is missing, or when delivery is disabled.
//   - Validates every input before any network call; invalid input returns
//     { status: "failed" } with a specific (non-secret) reason.
//   - Never leaks provider responses: network/provider failures return the
//     generic "Email could not be sent." so internals and secrets stay out of
//     logs and client-visible errors.
//   - 10s timeout (configurable per call via options.timeoutMs).
//
// Production notes (non-secret, must be arranged in the Resend dashboard):
//   - The sending domain (logistiqs.live) must be verified in Resend, and the
//     sender address must be an authorized identity on that domain, before the
//     API accepts delivery.
//   - This transport is for transactional email. Marketing/outreach email
//     must additionally carry a working unsubscribe/opt-out mechanism and must
//     only be sent to recipients who have opted in or otherwise approved
//     contact (per CAN-SPAM and local consumer-protection rules).
//   - Webhook signatures follow Svix's scheme, which is what Resend sends:
//     pass svixId/svixTimestamp alongside the raw body and the signature is
//     verified over `${svixId}.${svixTimestamp}.${rawBody}` with the key taken
//     from the base64 part of the `whsec_` secret. Callers that pass no ids
//     get the older body-only comparison (kept for non-Svix fixtures).
//     Freshness/replay windows are the caller's responsibility.
/// <reference types="node" />
import { createHmac, timingSafeEqual } from "node:crypto";

type EmailSendStatus = "sent" | "not_configured" | "failed";

export interface EmailSendResult {
  status: EmailSendStatus;
  /** Resend message id, present when status === "sent". */
  messageId?: string;
  /** Human-readable, non-secret reason when the email was not sent. */
  error?: string;
}

export interface EmailSendOptions {
  /** Recipient address(es). Required. Max 50 per message. */
  to: string | string[];
  /** Message subject. Required, max 998 characters. */
  subject: string;
  /** HTML body. At least one of html/text is required. */
  html?: string;
  /** Plain-text body. At least one of html/text is required. */
  text?: string;
  /** Sender, e.g. "Logistiqs <logistiqs@logistiqs.live>". Defaults to
   *  RESEND_EMAIL_FROM. */
  from?: string;
  /** Reply-to address(es). */
  replyTo?: string | string[];
  /** Blind-copy address(es). */
  bcc?: string | string[];
  /** Carbon-copy address(es). */
  cc?: string | string[];
  /** Extra headers passed through to Resend (max 20, values max 1000 chars). */
  headers?: Record<string, string>;
  /** Tags for Resend analytics/filtering (max 20, each part max 128 chars). */
  tags?: { name: string; value: string }[];
  /** Request timeout in ms. Defaults to 10_000. */
  timeoutMs?: number;
}

export interface EmailSignatureVerification {
  valid: boolean;
  reason?: string;
}

export interface VerifyWebhookSignatureOptions {
  /** Raw (unparsed) request body, exactly as received. */
  rawBody: string;
  /** Value of the svix-signature header (space-separated v1 signatures). */
  signatureHeader: string;
  /** Value of the svix-id header. Provide together with svixTimestamp to
   *  verify the scheme Resend actually signs. */
  svixId?: string;
  /** Value of the svix-timestamp header. */
  svixTimestamp?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RECIPIENTS = 50;
const MAX_EMAIL_ADDRESS_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 998;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // conservative vs Resend's 40MB cap
const MAX_HEADERS = 20;
const MAX_HEADER_VALUE_LENGTH = 1000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 128;
const MAX_FROM_LENGTH = 512;
/** Svix (Resend's webhook provider) prefixes its signing secrets with this. */
const SVIX_SECRET_PREFIX = "whsec_";

/** Pragmatic address shape check: local@domain.tld, no whitespace/angle
 *  brackets, no control characters (checked separately). */
const EMAIL_ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

function getApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

function getFromEnv(): string | null {
  const from = process.env.RESEND_EMAIL_FROM?.trim();
  return from ? from : null;
}

function getWebhookSecret(): string | null {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  return secret ? secret : null;
}

/** Delivery is blocked in tests and can be blocked explicitly via
 *  RESEND_DISABLE_DELIVERY (a dry-run kill-switch). */
function deliveryDisabled(): boolean {
  if (process.env.NODE_ENV === "test") return true;
  const flag = process.env.RESEND_DISABLE_DELIVERY?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** True when the API key is present so email could be sent. */
export function isConfigured(): boolean {
  return getApiKey() !== null;
}

/** True when the webhook signing secret is present so webhooks could be
 *  verified. */
export function isWebhookSecretConfigured(): boolean {
  return getWebhookSecret() !== null;
}

function isBase64(value: string): boolean {
  return (
    value.length > 0 &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

/**
 * The HMAC key used to verify webhook signatures.
 *
 * Resend signs with Svix, whose secrets look like `whsec_<base64 key material>`
 * — the key is the *decoded* remainder, not the literal string. Secrets that
 * are not in that shape (e.g. hand-rolled test fixtures) are used as UTF-8 so
 * callers signing with the literal secret keep working.
 */
function getWebhookSigningKey(): Buffer | null {
  const secret = getWebhookSecret();
  if (!secret) return null;
  if (secret.startsWith(SVIX_SECRET_PREFIX)) {
    const encoded = secret.slice(SVIX_SECRET_PREFIX.length);
    if (isBase64(encoded)) return Buffer.from(encoded, "base64");
  }
  return Buffer.from(secret, "utf-8");
}

function isValidEmailAddress(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > MAX_EMAIL_ADDRESS_LENGTH) return false;
  if (/[\x00-\x1f\x7f]/.test(email)) return false; // no control characters
  return EMAIL_ADDRESS_PATTERN.test(email);
}

/** Accepts "user@example.com" or "Name <user@example.com>". Returns null when
 *  the value is not a usable sender. */
function parseFrom(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FROM_LENGTH) return null;
  if (/[\r\n]/.test(trimmed)) return null; // no header injection
  const angleMatch = /<([^<>]+)>/.exec(trimmed);
  const address = angleMatch ? angleMatch[1]!.trim() : trimmed;
  return isValidEmailAddress(address) ? trimmed : null;
}

/** Normalizes a string-or-array recipient list. Returns null if any entry is
 *  invalid or the deduplicated list is empty or exceeds MAX_RECIPIENTS. */
function normalizeRecipients(
  value: string | string[] | undefined,
  allowEmpty: boolean,
): string[] | null {
  if (value === undefined) return allowEmpty ? [] : null;
  const raw = Array.isArray(value) ? value : [value];
  if (raw.length === 0) return allowEmpty ? [] : null;
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !isValidEmailAddress(entry)) return null;
    const email = entry.trim();
    if (!seen.has(email)) {
      seen.add(email);
      normalized.push(email);
    }
  }
  if (normalized.length === 0 || normalized.length > MAX_RECIPIENTS)
    return null;
  return normalized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validateOptions(options: EmailSendOptions): string | null {
  const to = normalizeRecipients(options.to, false);
  if (!to) {
    return `At least one valid recipient is required (max ${MAX_RECIPIENTS}, each max ${MAX_EMAIL_ADDRESS_LENGTH} characters).`;
  }
  if (
    typeof options.subject !== "string" ||
    options.subject.trim().length === 0
  ) {
    return "A non-empty subject is required.";
  }
  if (options.subject.trim().length > MAX_SUBJECT_LENGTH) {
    return `Subject may not exceed ${MAX_SUBJECT_LENGTH} characters.`;
  }
  if (options.html === undefined && options.text === undefined) {
    return "At least one of html or text is required.";
  }
  if (options.html !== undefined) {
    if (typeof options.html !== "string") return "html must be a string.";
    if (Buffer.byteLength(options.html, "utf8") > MAX_BODY_BYTES) {
      return `html body may not exceed ${MAX_BODY_BYTES} bytes.`;
    }
  }
  if (options.text !== undefined) {
    if (typeof options.text !== "string") return "text must be a string.";
    if (Buffer.byteLength(options.text, "utf8") > MAX_BODY_BYTES) {
      return `text body may not exceed ${MAX_BODY_BYTES} bytes.`;
    }
  }
  if (options.from !== undefined && parseFrom(options.from) === null) {
    return 'from must be an email address or "Name <email>".';
  }
  for (const key of ["replyTo", "cc", "bcc"] as const) {
    const value = options[key];
    if (value !== undefined && normalizeRecipients(value, false) === null) {
      return `${key} contains an invalid address (or exceeds ${MAX_RECIPIENTS} recipients).`;
    }
  }
  if (options.headers !== undefined) {
    if (!isPlainObject(options.headers)) return "headers must be an object.";
    const entries = Object.entries(options.headers);
    if (entries.length > MAX_HEADERS) {
      return `No more than ${MAX_HEADERS} headers per message.`;
    }
    for (const [name, value] of entries) {
      if (name.length === 0 || /[\r\n]/.test(name)) {
        return "Header names must be non-empty and free of line breaks.";
      }
      if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > MAX_HEADER_VALUE_LENGTH ||
        /[\r\n]/.test(value)
      ) {
        return `Header values must be strings of 1-${MAX_HEADER_VALUE_LENGTH} characters without line breaks.`;
      }
    }
  }
  if (options.tags !== undefined) {
    if (!Array.isArray(options.tags) || options.tags.length > MAX_TAGS) {
      return `tags must be an array of no more than ${MAX_TAGS} entries.`;
    }
    for (const tag of options.tags) {
      if (
        !isPlainObject(tag) ||
        typeof tag.name !== "string" ||
        typeof tag.value !== "string" ||
        tag.name.trim().length === 0 ||
        tag.name.trim().length > MAX_TAG_LENGTH ||
        tag.value.trim().length === 0 ||
        tag.value.trim().length > MAX_TAG_LENGTH
      ) {
        return `Each tag needs a name and value (1-${MAX_TAG_LENGTH} characters each).`;
      }
    }
  }
  if (
    options.timeoutMs !== undefined &&
    (typeof options.timeoutMs !== "number" ||
      !Number.isFinite(options.timeoutMs) ||
      options.timeoutMs <= 0 ||
      options.timeoutMs > 60_000)
  ) {
    return "timeoutMs must be a positive number up to 60000.";
  }
  return null;
}

function notConfiguredResult(detail: string): EmailSendResult {
  return { status: "not_configured", error: detail };
}

function buildPayload(
  options: EmailSendOptions,
  from: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from,
    to: normalizeRecipients(options.to, false)!, // validated above
    subject: options.subject.trim(),
  };
  if (options.html !== undefined) payload.html = options.html;
  if (options.text !== undefined) payload.text = options.text;
  if (options.replyTo !== undefined) {
    payload.reply_to = normalizeRecipients(options.replyTo, false)!;
  }
  if (options.cc !== undefined)
    payload.cc = normalizeRecipients(options.cc, false)!;
  if (options.bcc !== undefined) {
    payload.bcc = normalizeRecipients(options.bcc, false)!;
  }
  if (options.headers !== undefined) payload.headers = options.headers;
  if (options.tags !== undefined) {
    payload.tags = options.tags.map((tag) => ({
      name: tag.name.trim(),
      value: tag.value.trim(),
    }));
  }
  return payload;
}

/**
 * Send an email through the Resend API.
 *
 * Never performs a network call when:
 *  - the API key is not configured (returns not_configured), or
 *  - the sender is not configured (no options.from and no RESEND_EMAIL_FROM),
 *  - delivery is disabled (NODE_ENV === "test" or RESEND_DISABLE_DELIVERY set),
 *  - the input fails validation (returns failed).
 *
 * Provider/network failures always return the generic "Email could not be
 * sent." — provider error bodies are never propagated.
 */
export async function sendEmail(
  options: EmailSendOptions,
): Promise<EmailSendResult> {
  if (deliveryDisabled()) {
    return notConfiguredResult(
      "Email delivery is disabled (NODE_ENV=test or RESEND_DISABLE_DELIVERY set).",
    );
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    return notConfiguredResult(
      "Resend is not configured: RESEND_API_KEY is missing.",
    );
  }
  const from =
    options.from !== undefined ? parseFrom(options.from) : getFromEnv();
  if (!from) {
    // A caller-supplied sender that does not parse is a bad request, not a
    // missing configuration; reporting it as not_configured would hide the bug.
    if (options.from !== undefined) {
      return {
        status: "failed",
        error: 'from must be an email address or "Name <email>".',
      };
    }
    return notConfiguredResult(
      "Resend is not configured: RESEND_EMAIL_FROM is missing and no from address was provided.",
    );
  }
  const inputError = validateOptions(options);
  if (inputError) {
    return { status: "failed", error: inputError };
  }
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildPayload(options, from)),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (response.ok) {
      const messageId = typeof data.id === "string" ? data.id : undefined;
      return messageId ? { status: "sent", messageId } : { status: "sent" };
    }
    // Generic on purpose: never surface provider error bodies.
    return { status: "failed", error: "Email could not be sent." };
  } catch {
    return { status: "failed", error: "Email could not be sent." };
  }
}

/**
 * Verify that an inbound webhook request signed by Resend is authentic.
 *
 * Resend signs webhooks with Svix's scheme: the svix-signature header carries
 * one or more space-separated entries of the form "v1,<base64 hmac-sha256>"
 * ("v1=<sig>" is also accepted), and the signed content is
 * `${svix-id}.${svix-timestamp}.${raw body}` — so callers should pass the
 * svix-id and svix-timestamp header values. When neither is supplied the raw
 * body alone is treated as the signed content (a simple body-only scheme kept
 * for non-Svix callers and fixtures). The HMAC key comes from
 * RESEND_WEBHOOK_SECRET (base64-decoded when it has Svix's `whsec_` prefix).
 * Comparison is timing-safe; verification fails closed when the secret is
 * missing, the header is malformed, or no signature matches. Replay/freshness
 * windows are the caller's responsibility.
 */
export function verifyWebhookSignature(
  options: VerifyWebhookSignatureOptions,
): EmailSignatureVerification {
  const signingKey = getWebhookSigningKey();
  if (!signingKey) {
    return {
      valid: false,
      reason: "Resend is not configured: RESEND_WEBHOOK_SECRET is missing.",
    };
  }
  if (typeof options.signatureHeader !== "string") {
    return { valid: false, reason: "Malformed svix-signature header." };
  }
  const entries = options.signatureHeader.split(" ").filter(Boolean);
  if (entries.length === 0) {
    return { valid: false, reason: "Malformed svix-signature header." };
  }
  // Svix signs the id and timestamp along with the body; the body alone is the
  // fallback for callers that do not have those headers.
  const signedPayload =
    options.svixId !== undefined && options.svixTimestamp !== undefined
      ? `${options.svixId}.${options.svixTimestamp}.${options.rawBody}`
      : options.rawBody;
  const expected = createHmac("sha256", signingKey)
    .update(signedPayload)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  let sawWellFormedEntry = false;
  for (const entry of entries) {
    // Accept both "v1=<sig>" and "v1,<sig>" forms.
    const signature = entry.startsWith("v1=")
      ? entry.slice(3)
      : entry.startsWith("v1,")
        ? entry.slice(3)
        : null;
    if (!signature || signature.length === 0) continue;
    sawWellFormedEntry = true;
    const providedBuffer = Buffer.from(signature, "utf-8");
    if (providedBuffer.length !== expectedBuffer.length) continue;
    if (timingSafeEqual(expectedBuffer, providedBuffer)) {
      return { valid: true };
    }
  }
  return sawWellFormedEntry
    ? { valid: false, reason: "Signature mismatch." }
    : { valid: false, reason: "Malformed svix-signature header." };
}
