import type { JsonObject, JsonValue } from "./activity-log-types";

const MAX_ARRAY_ITEMS = 100;
const MAX_DEPTH = 8;
const MAX_OBJECT_KEYS = 200;
const MAX_PAYLOAD_BYTES = 16 * 1024;
const MAX_STRING_LENGTH = 2048;
const MAX_BODY_PARSE_BYTES = 256 * 1024;

const SENSITIVE_KEY_PATTERN =
  /(^|_)(authorization|cookie|cvv|password|password_confirmation|pin|private_key|refresh_token|secret|token|access_token|api_key|otp|card_number)($|_)/i;

type SanitizedPayload = {
  metadata: JsonObject;
  payload: JsonValue | null;
};

function sanitizeString(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}[truncated]`
    : value;
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();
  return SENSITIVE_KEY_PATTERN.test(normalizedKey);
}

export function sanitizeActivityData(value: unknown, depth = 0): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (depth >= MAX_DEPTH) {
    return "[depth-limit]";
  }

  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeActivityData(item, depth + 1));

    if (value.length > MAX_ARRAY_ITEMS) {
      sanitized.push(`[${value.length - MAX_ARRAY_ITEMS} items omitted]`);
    }

    return sanitized;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const sanitized: JsonObject = {};

    entries.slice(0, MAX_OBJECT_KEYS).forEach(([key, item]) => {
      sanitized[key] = isSensitiveKey(key) ? "[redacted]" : sanitizeActivityData(item, depth + 1);
    });

    if (entries.length > MAX_OBJECT_KEYS) {
      sanitized._omittedKeys = entries.length - MAX_OBJECT_KEYS;
    }

    return sanitized;
  }

  return String(value);
}

function enforcePayloadSize(payload: JsonValue): SanitizedPayload {
  const serialized = JSON.stringify(payload);
  const size = Buffer.byteLength(serialized, "utf8");

  if (size <= MAX_PAYLOAD_BYTES) {
    return { payload, metadata: {} };
  }

  return {
    payload: {
      omitted: true,
      originalSanitizedBytes: size,
      reason: "payload-size-limit",
    },
    metadata: {
      payloadTruncated: true,
      sanitizedPayloadBytes: size,
    },
  };
}

function formDataToObject(formData: FormData): JsonObject {
  const result: JsonObject = {};

  formData.forEach((value, key) => {
    const sanitizedValue: JsonValue = isSensitiveKey(key)
      ? "[redacted]"
      : typeof value === "string"
        ? sanitizeString(value)
        : {
            fileName: sanitizeString(value.name),
            contentType: sanitizeString(value.type),
            size: value.size,
          };

    const existing = result[key];
    if (existing === undefined) {
      result[key] = sanitizedValue;
    } else if (Array.isArray(existing)) {
      existing.push(sanitizedValue);
    } else {
      result[key] = [existing, sanitizedValue];
    }
  });

  return result;
}

export async function captureSanitizedRequestPayload(request: Request): Promise<SanitizedPayload> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (contentLength > MAX_BODY_PARSE_BYTES) {
    return {
      payload: {
        contentLength,
        contentType: sanitizeString(contentType),
        omitted: true,
        reason: "body-parse-limit",
      },
      metadata: { payloadTruncated: true },
    };
  }

  try {
    if (contentType.includes("application/json")) {
      return enforcePayloadSize(sanitizeActivityData(await request.json()));
    }

    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      return enforcePayloadSize(formDataToObject(await request.formData()));
    }

    if (contentLength === 0) {
      return { payload: null, metadata: {} };
    }

    return {
      payload: {
        contentLength,
        contentType: sanitizeString(contentType),
        omitted: true,
        reason: "unsupported-content-type",
      },
      metadata: {},
    };
  } catch {
    return {
      payload: { omitted: true, reason: "unreadable-request-body" },
      metadata: { payloadReadFailed: true },
    };
  }
}
