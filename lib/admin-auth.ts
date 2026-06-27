import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { Business } from "@/lib/types";
import { getAdminPassword, getServerSecret, verifyStaffPassword } from "./secret";

/**
 * Per-clinic staff auth. A password gate that sets an httpOnly, SameSite=Strict
 * session cookie (security-review skill). The session is **scoped to a single
 * business**: the cookie value binds the businessId, so a session issued for one
 * clinic cannot authorize another. The password is the clinic's own (a scrypt
 * hash in its config, set by the operator); the legacy global ADMIN_PASSWORD is
 * a fallback only when a clinic has no hash yet (e.g. the seeded demo). Secrets
 * fail closed in production (see ./secret).
 */
export const ADMIN_COOKIE = "admin_session";
export const ADMIN_MAX_AGE = 60 * 60 * 8; // 8 hours

/** Opaque session value bound to one business. */
export function sessionToken(businessId: string): string {
  const sig = createHmac("sha256", getServerSecret())
    .update(`admin-session-v1:${businessId}`)
    .digest("hex");
  return `${businessId}.${sig}`;
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

/** Authed for THIS business only — a cookie for another clinic won't match. */
export function isAuthed(req: NextRequest, businessId: string): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(token && safeEqual(token, sessionToken(businessId)));
}
