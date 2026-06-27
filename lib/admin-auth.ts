import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { Business } from "@/lib/types";
import { getAdminPassword, getServerSecret, verifyStaffPassword } from "./secret";

/**
 * Per-clinic staff auth. The session cookie embeds an issuedAt timestamp so
 * the server can enforce expiry even if the cookie's Max-Age is stripped or
 * replayed. Token format: "${businessId}:${issuedAtSec}.${hmac-sha256}".
 */
export const ADMIN_COOKIE = "admin_session";
export const ADMIN_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds

/** Opaque session value bound to one business and a point in time. */
export function sessionToken(businessId: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const payload = `${businessId}:${nowSec}`;
  const sig = createHmac("sha256", getServerSecret())
    .update(`admin-session-v2:${payload}`)
    .digest("hex");
  return `${payload}.${sig}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Verify a clinic's staff password: its own hash if set, else the legacy global. */
export function verifyPassword(input: string, business: Business): boolean {
  const staffAuth = business.config.staffAuth;
  if (staffAuth?.hash) return verifyStaffPassword(input, staffAuth);
  const password = getAdminPassword();
  if (!password) return false; // admin login disabled until configured (prod)
  return safeEqual(input, password);
}

/** Authed for THIS business only — validates HMAC and server-side expiry. */
export function isAuthed(req: NextRequest, businessId: string): boolean {
  const raw = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!raw) return false;

  const dotIdx = raw.lastIndexOf(".");
  if (dotIdx === -1) return false;
  const payload = raw.slice(0, dotIdx);
  const providedSig = raw.slice(dotIdx + 1);

  // payload = "${businessId}:${issuedAtSec}"
  const colonIdx = payload.indexOf(":");
  if (colonIdx === -1) return false;
  const tokenBizId = payload.slice(0, colonIdx);
  const issuedAt = parseInt(payload.slice(colonIdx + 1), 10);

  if (tokenBizId !== businessId || isNaN(issuedAt)) return false;

  const expectedSig = createHmac("sha256", getServerSecret())
    .update(`admin-session-v2:${payload}`)
    .digest("hex");
  if (!safeEqual(providedSig, expectedSig)) return false;

  // Enforce expiry server-side — captured tokens go stale after MAX_AGE.
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec - issuedAt <= ADMIN_MAX_AGE;
}
