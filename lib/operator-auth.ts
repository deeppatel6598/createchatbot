import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { getOperatorPassword, getOperatorSecret } from "./secret";

/**
 * Operator (platform super-admin) auth. Token format: "${issuedAtSec}.${hmac-sha256}".
 * The issuedAt is verified server-side so captured tokens expire after MAX_AGE.
 */
export const OPERATOR_COOKIE = "operator_session";
export const OPERATOR_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds

export function operatorSessionToken(nowSec = Math.floor(Date.now() / 1000)): string {
  const payload = String(nowSec);
  const sig = createHmac("sha256", getOperatorSecret())
    .update(`operator-session-v2:${payload}`)
    .digest("hex");
  return `${payload}.${sig}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyOperatorPassword(input: string): boolean {
  const password = getOperatorPassword();
  if (!password) return false; // disabled until OPERATOR_PASSWORD is set (prod)
  return safeEqual(input, password);
}

export function isOperator(req: NextRequest): boolean {
  const raw = req.cookies.get(OPERATOR_COOKIE)?.value;
  if (!raw) return false;

  const dotIdx = raw.indexOf(".");
  if (dotIdx === -1) return false;
  const payload = raw.slice(0, dotIdx);
  const providedSig = raw.slice(dotIdx + 1);

  const issuedAt = parseInt(payload, 10);
  if (isNaN(issuedAt)) return false;

  const expectedSig = createHmac("sha256", getOperatorSecret())
    .update(`operator-session-v2:${payload}`)
    .digest("hex");
  if (!safeEqual(providedSig, expectedSig)) return false;

  // Enforce expiry server-side — captured tokens go stale after MAX_AGE.
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec - issuedAt <= OPERATOR_MAX_AGE;
}
