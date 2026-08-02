// Server-only MessageBird (Bird) transport for transactional SMS and WhatsApp.
// A safe alternative to the Twilio transport in twilio.ts — same shape, same
// guarantees: credentials and sender identities are read at call time from
// runtime env vars, and nothing is sent unless every required setting exists.
// This module is server-only; never import it on the client.
//
// Configuration (runtime env vars, never committed):
//   MESSAGEBIRD_API_KEY               — required for both channels
//   MESSAGEBIRD_ORIGINATOR            — SMS sender: verified E.164 number
//                                       (e.g. +27820000000) or max 11
//                                       alphanumeric chars (e.g. LOGISTIQS)
//   MESSAGEBIRD_WHATSAPP_CHANNEL_ID   — WhatsApp channel id (from the MessageBird
//                                       dashboard; the channel's number must be
//                                       verified and linked to a WhatsApp Business
//                                       Account)
//
// Production notes (non-secret, must be arranged in the MessageBird dashboard):
//   - The SMS originator must be approved/verified by MessageBird for the region.
//   - WhatsApp business-initiated messages require a pre-approved template (HSM)
//     and prior recipient opt-in. This transport sends a plain text message, so
//     MessageBird may reject it until a template and opt-in flow are in place.
//     The provider error is surfaced verbatim in the result.
//   - Keep the API key server-side only and scope it to the required products.

type Channel = "sms" | "whatsapp";

export interface MessageBirdSendResult {
  status: "sent" | "not_configured" | "failed";
  id?: string;
  error?: string;
}

const SMS_API_URL = "https://rest.messagebird.com/messages";
const CONVERSATIONS_API_URL = "https://conversations.messagebird.com/v1/send";
const REQUEST_TIMEOUT_MS = 10_000;

// Alphanumeric SMS originators may be at most 11 characters (GSM spec).
const MAX_ALPHANUMERIC_ORIGINATOR_LENGTH = 11;
// Recipients and phone-number originators must be E.164: "+" + country code + number.
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

interface MessageBirdResponse {
  id?: string;
  errors?: Array<{ description?: string; parameter?: string }>;
}

function getConfig(channel: Channel) {
  const apiKey = process.env.MESSAGEBIRD_API_KEY?.trim();
  const sender =
    channel === "sms"
      ? process.env.MESSAGEBIRD_ORIGINATOR?.trim()
      : process.env.MESSAGEBIRD_WHATSAPP_CHANNEL_ID?.trim();

  if (!apiKey || !sender) return null;
  return { apiKey, sender };
}

function notConfiguredError(channel: Channel): MessageBirdSendResult {
  const required =
    channel === "sms"
      ? "MESSAGEBIRD_API_KEY and MESSAGEBIRD_ORIGINATOR"
      : "MESSAGEBIRD_API_KEY and MESSAGEBIRD_WHATSAPP_CHANNEL_ID";
  return {
    status: "not_configured",
    error: `MessageBird ${channel} is not configured (${required} required).`,
  };
}

function normalizeRecipient(value: string): string {
  const number = value.replace(/^whatsapp:/i, "").trim();
  return number.startsWith("+") ? number : `+${number}`;
}

function validateSender(channel: Channel, sender: string): string | null {
  if (channel === "whatsapp") return null; // channel id is opaque, non-empty checked above
  if (sender.startsWith("+")) {
    if (!E164_PATTERN.test(sender)) {
      return `MessageBird SMS originator "${sender}" is not a valid E.164 phone number.`;
    }
    return null;
  }
  if (
    sender.length <= MAX_ALPHANUMERIC_ORIGINATOR_LENGTH &&
    /^[A-Za-z0-9]+$/.test(sender)
  ) {
    return null;
  }
  return `MessageBird SMS originator "${sender}" must be max ${MAX_ALPHANUMERIC_ORIGINATOR_LENGTH} alphanumeric characters or a valid E.164 phone number.`;
}

function validateInput(to: string, body: string): string | null {
  const recipient = normalizeRecipient(to);
  if (!E164_PATTERN.test(recipient)) {
    return "A valid E.164 recipient phone number is required.";
  }
  if (!body.trim()) {
    return "A message body is required.";
  }
  return null;
}

async function send(
  channel: Channel,
  to: string,
  body: string,
): Promise<MessageBirdSendResult> {
  const config = getConfig(channel);
  if (!config) {
    return notConfiguredError(channel);
  }

  const senderError = validateSender(channel, config.sender);
  if (senderError) {
    return { status: "failed", error: senderError };
  }
  const inputError = validateInput(to, body);
  if (inputError) {
    return { status: "failed", error: inputError };
  }

  const recipient = normalizeRecipient(to);
  const payload =
    channel === "sms"
      ? {
          originator: config.sender,
          body: body.trim(),
          recipients: [recipient],
        }
      : {
          to: recipient,
          type: "text",
          content: { text: body.trim() },
          channelId: config.sender,
        };
  const endpoint = channel === "sms" ? SMS_API_URL : CONVERSATIONS_API_URL;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = (await response
      .json()
      .catch(() => ({}))) as MessageBirdResponse;
    if (response.ok) {
      return { status: "sent", id: data.id };
    }
    const messageBirdError = data.errors?.[0];
    const detail = messageBirdError?.description
      ? `${messageBirdError.description}${
          messageBirdError.parameter
            ? ` (parameter: ${messageBirdError.parameter})`
            : ""
        }`
      : `MessageBird request failed (${response.status}).`;
    return { status: "failed", error: detail };
  } catch {
    return {
      status: "failed",
      error: "MessageBird request could not be completed.",
    };
  }
}

export function sendSMS(to: string, body: string) {
  return send("sms", to, body);
}

export function sendWhatsApp(to: string, body: string) {
  return send("whatsapp", to, body);
}
