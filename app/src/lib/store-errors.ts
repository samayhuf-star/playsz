/** Friendly, non-technical store error helpers. No expo-iap import, so unit tests can load this file. */

const ENVELOPE_PREFIX = 'OPENIAP_ERROR_JSON:';

const CANCEL_CODE =
  /user[_-]?cancell?ed|user[_-]?cancel|e_user_cancell?ed|skerrorpaymentcancell?ed/i;

const CANCEL_MESSAGE =
  /user cancell?ed|cancell?ed by the user|cancell?ed by user|purchase cancell?ed|restore cancell?ed|payment cancell?ed/i;

type Envelope = {
  code?: unknown;
  message?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function sliceJsonObject(payload: string): string | undefined {
  const start = payload.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < payload.length; index += 1) {
    const character = payload[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return payload.slice(start, index + 1);
    }
  }
  return undefined;
}

function parseEnvelope(text: string): Envelope | null {
  const marker = text.indexOf(ENVELOPE_PREFIX);
  if (marker < 0) return null;
  const object = sliceJsonObject(text.slice(marker + ENVELOPE_PREFIX.length));
  if (!object) return null;
  try {
    const parsed = JSON.parse(object) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function collectText(error: unknown): string {
  if (typeof error === 'string') return error;
  const record = asRecord(error);
  if (!record) return '';
  const parts = [record.message, record.debugMessage, record.code, record.cause]
    .map((part) => (typeof part === 'string' ? part : ''))
    .filter(Boolean);
  if (record.cause) parts.push(collectText(record.cause));
  return parts.join(' ');
}

function codeFrom(error: unknown): string {
  const record = asRecord(error);
  if (record && (typeof record.code === 'string' || typeof record.code === 'number')) {
    return String(record.code);
  }
  if (typeof error === 'string') return error;
  return '';
}

export function isStoreUserCancel(error: unknown): boolean {
  if (!error) return false;
  const code = codeFrom(error);
  if (CANCEL_CODE.test(code)) return true;
  const text = collectText(error);
  const envelope = parseEnvelope(text);
  if (envelope) {
    const envelopeCode = envelope.code != null ? String(envelope.code) : '';
    const envelopeMessage = envelope.message != null ? String(envelope.message) : '';
    if (CANCEL_CODE.test(envelopeCode) || CANCEL_MESSAGE.test(envelopeMessage)) {
      return true;
    }
  }
  return CANCEL_MESSAGE.test(text) || CANCEL_CODE.test(text);
}

/**
 * Always returns a short, human message written by us. Never returns raw JSON,
 * error codes, OPENIAP envelopes, or native store text. Callers should skip
 * this and show nothing on cancel.
 */
export function friendlyStoreMessage(error: unknown, fallback: string): string {
  if (isStoreUserCancel(error)) return '';
  return fallback;
}
