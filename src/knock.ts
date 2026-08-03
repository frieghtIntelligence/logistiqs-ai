// Server-only Knock notification transport for transactional notifications
// (email, SMS, WhatsApp, in-app feed via Knock workflows).
//
// Safe by default — same guarantees as the Twilio/MessageBird transports:
// credentials are read at runtime from env vars, nothing is sent unless every
// required setting exists, and nothing is ever sent from a test environment.
// This module is server-only; never import it on the client.
//
// Configuration (runtime env vars, never committed):
//   KNOCK_API_KEY            — required to trigger workflows (server API key,
//                              e.g. sk_... for the production environment).
//   KNOCK_SIGNING_KEY        — required to verify inbound webhook signatures
//                              (x-knock-signature). Found on the webhook's page
//                              in the Knock dashboard (Platform > Webhooks).
//   KNOCK_DISABLE_DELIVERY   — optional kill-switch. Set to "1" or "true" to
//                              make every trigger return not_configured without
//                              calling Knock (e.g. for demos or dry runs).
//                              Delivery is also always disabled when
//                              NODE_ENV === "test".
//
// Production notes (non-secret, must be arranged in the Knock dashboard):
//   - Create the workflows that freight events will trigger (e.g. load_posted,
//     load_accepted, load_delivered) under "Designer". The workflow key passed
//     to triggerWorkflow() must match an existing workflow.
//   - Recipients are identified by Knock user IDs. Before (or instead of)
//     triggering, upsert users with `POST /v1/users/{user_id}` so their channel
//     data (email address, phone number, push token) exists; otherwise Knock
//     creates empty users and no channel can deliver. IDs must be stable
//     strings (e.g. the app user's UUID) and should match across environments.
//   - Channels (email provider, SMS provider, WhatsApp) must be connected and
//     configured per environment in the dashboard, and sender identities
//     verified before real delivery works. Knock sandbox mode can be enabled
//     per environment to exercise workflows without delivering.
//   - The trigger endpoint has a 10MB data limit; individual string values
//     longer than 1024 bytes are truncated in logs.
//   - Keep both keys server-side only, scoped to the required products.
import { createHmac, timingSafeEqual } from "node:crypto";

type KnockStatus = "sent" | "not_configured" | "failed";

export interface KnockSendResult {
  status: KnockStatus;
  /** Knock workflow run id, present when status === "sent". */
  workflowRunId?: string;
  error?: string;
}

export interface KnockTriggerOptions {
  /** Workflow key as defined in the Knock dashboard, e.g. "load-accepted". */
  workflow: string;
  /** Knock user IDs to notify. Must be non-empty; capped at MAX_RECIPIENTS. */
  recipients: string[];
  /** Template variables for the workflow. Must be a plain JSON object. */
  data?: Record<string, unknown>;
  /** User ID attributed as the actor (who performed the triggering action). */
  actor?: string;
  /** Tenant ID to scope the workflow run to a tenant. */
  tenant?: string;
  /** When true, pass settings.sandbox_mode so messages are generated but not
   *  delivered to the underlying providers (Knock-side dry run). */
  sandboxMode?: boolean;
  /** Optional idempotency key (Idempotency-Key header) for safe retries. */
  idempotencyKey?: string;
}

export interface KnockSignatureVerification {
  valid: boolean;
  reason?: string;
}

export interface VerifyWebhookSignatureOptions {
  /** Raw (unparsed) request body, exactly as received. */
  rawBody: string;
  /** Value of the x-knock-signature header: "t=<ms>,s=<base64>". */
  signatureHeader: string;
  /** Current time in ms (injected for tests). Defaults to Date.now(). */
  now?: number;
  /** Allowed age of the timestamp in ms. Defaults to 5 minutes. */
  toleranceMs?: number;
}

const TRIGGER_API_URL = "https://api.knock.app/v1/workflows/{workflow}/trigger";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RECIPIENTS = 100;
const MAX_ID_LENGTH = 128;
const WORKFLOW_KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const MAX_JSON_PAYLOAD_BYTES = 1_000_000; // Knock allows 10MB; we cap earlier
const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

function getApiKey(): string | null {
  const key = process.env.KNOCK_API_KEY?.trim();
  return key ? key : null;
}

function getSigningKey(): string | null {
  const key = process.env.KNOCK_SIGNING_KEY?.trim();
  return key ? key : null;
}

/** Delivery is blocked in tests and can be blocked explicitly via
 *  KNOCK_DISABLE_DELIVERY (a dry-run kill-switch). */
function deliveryDisabled(): boolean {
  if (process.env.NODE_ENV === "test") return true;
  const flag = process.env.KNOCK_DISABLE_DELIVERY?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** True when the API key is present so workflows could be triggered. */
export function isConfigured(): boolean {
  return getApiKey() !== null;
}

/** True when the signing key is present so webhooks could be verified. */
export function isSigningKeyConfigured(): boolean {
  return getSigningKey() !== null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isUsableId(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    !/\s/.test(value)
  );
}

function validateOptions(options: KnockTriggerOptions): string | null {
  if (!isUsableId(options.workflow)) {
    return "A workflow key is required (max 128 characters, no whitespace).";
  }
  if (!WORKFLOW_KEY_PATTERN.test(options.workflow)) {
    return "Workflow key may only contain letters, numbers, dots, dashes and underscores (max 64 characters).";
  }
  if (!Array.isArray(options.recipients) || options.recipients.length === 0) {
    return "At least one recipient user ID is required.";
  }
  if (options.recipients.length > MAX_RECIPIENTS) {
    return `No more than ${MAX_RECIPIENTS} recipients per trigger.`;
  }
  if (!options.recipients.every(isUsableId)) {
    return "Each recipient must be a non-empty user ID (max 128 characters, no whitespace).";
  }
  if (options.data !== undefined && !isPlainObject(options.data)) {
    return "Trigger data must be a plain JSON object.";
  }
  if (options.actor !== undefined && !isUsableId(options.actor)) {
    return "Actor must be a non-empty user ID (max 128 characters, no whitespace).";
  }
  if (options.tenant !== undefined && !isUsableId(options.tenant)) {
    return "Tenant must be a non-empty tenant ID (max 128 characters, no whitespace).";
  }
  if (
    options.idempotencyKey !== undefined &&
    !isUsableId(options.idempotencyKey)
  ) {
    return "Idempotency key must be a non-empty string (max 128 characters, no whitespace).";
  }
  return null;
}

function notConfiguredError(detail: string): KnockSendResult {
  return { status: "not_configured", error: detail };
}

function providerError(data: unknown, status: number): string {
  if (isPlainObject(data)) {
    const error = data.error;
    if (isPlainObject(error) && typeof error.message === "string") {
      return error.message;
    }
    if (typeof data.message === "string") {
      return data.message;
    }
  }
  return `Knock request failed (${status}).`;
}

/**
 * Trigger a Knock workflow for one or more recipients.
 *
 * Never performs a network call when:
 *  - the API key is not configured (returns not_configured), or
 *  - delivery is disabled (NODE_ENV === "test" or KNOCK_DISABLE_DELIVERY set),
 *  - the input fails validation (returns failed).
 */
export async function triggerWorkflow(
  options: KnockTriggerOptions,
): Promise<KnockSendResult> {
  if (deliveryDisabled()) {
    return notConfiguredError(
      "Knock delivery is disabled (NODE_ENV=test or KNOCK_DISABLE_DELIVERY set).",
    );
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    return notConfiguredError(
      "Knock is not configured: KNOCK_API_KEY is missing.",
    );
  }
  const inputError = validateOptions(options);
  if (inputError) {
    return { status: "failed", error: inputError };
  }

  const recipients = [...new Set(options.recipients.map((id) => id.trim()))];
  const payload: Record<string, unknown> = { recipients };
  if (options.data !== undefined) payload.data = options.data;
  if (options.actor !== undefined) payload.actor = options.actor.trim();
  if (options.tenant !== undefined) payload.tenant = options.tenant.trim();
  if (options.sandboxMode !== undefined) {
    payload.settings = { sandbox_mode: options.sandboxMode };
  }

  const endpoint = TRIGGER_API_URL.replace(
    "{workflow}",
    encodeURIComponent(options.workflow),
  );
  try {
    const body = JSON.stringify(payload);
    if (body.length > MAX_JSON_PAYLOAD_BYTES) {
      return {
        status: "failed",
        error: "Trigger payload is too large (max 1MB serialized).",
      };
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (options.idempotencyKey !== undefined) {
      headers["Idempotency-Key"] = options.idempotencyKey.trim();
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (response.ok) {
      const workflowRunId =
        typeof data.workflow_run_id === "string"
          ? data.workflow_run_id
          : undefined;
      return workflowRunId
        ? { status: "sent", workflowRunId }
        : { status: "sent" };
    }
    return { status: "failed", error: providerError(data, response.status) };
  } catch {
    return {
      status: "failed",
      error: "Knock request could not be completed.",
    };
  }
}

/**
 * Verify that an inbound request signed by Knock is authentic.
 *
 * Knock signs webhooks (and signed fetch-function requests) with HMAC-SHA256
 * over "<timestamp_ms>.<raw body>" using the signing key, delivered in the
 * x-knock-signature header as "t=<timestamp_ms>,s=<base64 signature>".
 * Returns valid:false when the signing key is not configured, the header is
 * malformed, the signature does not match, or the timestamp is stale.
 */
export function verifyWebhookSignature(
  options: VerifyWebhookSignatureOptions,
): KnockSignatureVerification {
  const signingKey = getSigningKey();
  if (!signingKey) {
    return {
      valid: false,
      reason: "Knock is not configured: KNOCK_SIGNING_KEY is missing.",
    };
  }
  const now = options.now ?? Date.now();
  const toleranceMs = options.toleranceMs ?? SIGNATURE_TOLERANCE_MS;
  const parts = options.signatureHeader.split(",");
  if (parts.length !== 2) {
    return { valid: false, reason: "Malformed x-knock-signature header." };
  }
  const timestamp = parts[0]?.startsWith("t=") ? parts[0].slice(2) : null;
  const signature = parts[1]?.startsWith("s=") ? parts[1].slice(2) : null;
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) {
    return { valid: false, reason: "Malformed x-knock-signature header." };
  }
  if (Math.abs(now - Number(timestamp)) > toleranceMs) {
    return {
      valid: false,
      reason: "Signature timestamp is outside the tolerance window.",
    };
  }

  const expected = createHmac("sha256", signingKey)
    .update(`${timestamp}.${options.rawBody}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  const providedBuffer = Buffer.from(signature, "utf-8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return { valid: false, reason: "Signature mismatch." };
  }
  const matches = timingSafeEqual(expectedBuffer, providedBuffer);
  return matches
    ? { valid: true }
    : { valid: false, reason: "Signature mismatch." };
}
