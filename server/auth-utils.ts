import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE_NAME = "sig_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  exp: number;
  sub: string;
};

function readHeaderValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function getSessionSecret() {
  const sessionSecret = process.env.SESSION_SECRET?.trim();

  if (!sessionSecret) {
    throw new Error("SESSION_SECRET no esta configurada");
  }

  return sessionSecret;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

  return `scrypt$${toBase64Url(salt)}$${toBase64Url(derivedKey)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, saltValue, hashValue] = storedHash.split("$");

  if (algorithm !== "scrypt" || !saltValue || !hashValue) {
    return false;
  }

  const salt = fromBase64Url(saltValue);
  const expectedHash = fromBase64Url(hashValue);
  const derivedKey = (await scryptAsync(password, salt, expectedHash.length)) as Buffer;

  if (derivedKey.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedHash);
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    sub: userId,
  } satisfies SessionPayload;

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      fromBase64Url(encodedPayload).toString("utf-8")
    ) as SessionPayload;

    if (!payload.sub || !payload.exp) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getCookieValue(
  headers: IncomingHttpHeaders | Record<string, string>,
  name: string
) {
  const cookieHeader = readHeaderValue(
    "cookie" in headers ? headers.cookie : undefined
  );

  if (!cookieHeader) {
    return undefined;
  }

  const segments = cookieHeader.split(";");

  for (const segment of segments) {
    const separatorIndex = segment.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return undefined;
}

function isSecureRequest(req: IncomingMessage) {
  const forwardedProto = readHeaderValue(req.headers["x-forwarded-proto"]);

  if (forwardedProto) {
    const proto = forwardedProto.split(",")[0]?.trim().toLowerCase();

    if (proto === "https") {
      return true;
    }
  }

  const origin = readHeaderValue(req.headers.origin);

  if (origin?.startsWith("https://")) {
    return true;
  }

  if (req.url) {
    try {
      return new URL(req.url).protocol === "https:";
    } catch {
      return false;
    }
  }

  return false;
}

function buildCookieBase(req: IncomingMessage) {
  const secure = isSecureRequest(req);

  return [
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ];
}

export function buildSessionCookie(req: IncomingMessage, token: string) {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    ...buildCookieBase(req),
  ].join("; ");
}

export function buildClearSessionCookie(req: IncomingMessage) {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    ...buildCookieBase(req),
  ].join("; ");
}
