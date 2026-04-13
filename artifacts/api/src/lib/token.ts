import crypto from "node:crypto";
import { env } from "./env.js";

export type ApprovalTokenPayload = {
  sub: string;
  planId: string;
  planHash: string;
  workspaceId: string;
  scope: "repoguardian:execute";
  iat: number;
  exp: number;
};

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", env.API_SECRET_KEY)
    .update(payload)
    .digest("base64url");
}

export function mintApprovalToken(
  planId: string,
  planHash: string,
  userId: string,
  workspaceId: string,
  ttlMinutes: number = 15
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlMinutes * 60;

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadStr = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      planId,
      planHash,
      workspaceId,
      scope: "repoguardian:execute",
      iat,
      exp
    })
  );

  const signature = sign(`${header}.${payloadStr}`);
  return `${header}.${payloadStr}.${signature}`;
}

export function verifyApprovalToken(token: string): ApprovalTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [header, payload, signature] = parts;
  const expectedSignature = sign(`${header}.${payload}`);

  if (signature !== expectedSignature) {
    throw new Error("Invalid token signature");
  }

  const decodedPayload = JSON.parse(base64UrlDecode(payload ?? ""));

  if (decodedPayload.exp * 1000 < Date.now()) {
    throw new Error("Token has expired");
  }

  if (decodedPayload.scope !== "repoguardian:execute") {
    throw new Error("Invalid token scope");
  }

  return decodedPayload;
}
