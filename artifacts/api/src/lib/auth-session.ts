import crypto from "node:crypto";
import { env } from "./env.js";

export type SessionPayload = {
  activeWorkspaceId: string | null;
  authMode: "session";
  userId: string;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const remainder = padded.length % 4;
  const normalized = remainder === 0 ? padded : padded.padEnd(padded.length + (4 - remainder), "=");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function sign(value: string): string {
  return base64UrlEncode(
    crypto.createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64")
  );
}

export function serializeSessionCookie(payload: SessionPayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function parseSessionCookie(cookieValue: string): SessionPayload {
  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid session cookie.");
  }

  const expected = sign(encodedPayload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid session signature.");
  }

  return JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
}

export function parseCookies(headerValue?: string): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return headerValue.split(";").reduce<Record<string, string>>((cookies, chunk) => {
    const [name, ...rest] = chunk.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
    return cookies;
  }, {});
}

export function createSessionSetCookieHeader(payload: SessionPayload): string {
  const parts = [
    `${env.SESSION_COOKIE_NAME}=${encodeURIComponent(serializeSessionCookie(payload))}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax"
  ];

  if (env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function createClearedSessionSetCookieHeader(): string {
  return `${env.SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${
    env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}
