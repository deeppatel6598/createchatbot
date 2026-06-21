import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Server secret used to sign admin sessions and the returning-client cookie.
 * Fails closed in production: if ADMIN_SECRET is unset we refuse to fall back to
 * a guessable default (which would let anyone forge an admin session), so the
 * app must be configured with a real secret before it can authenticate anyone.
 */
const DEV_FALLBACK = "dev-insecure-secret-change-me";
const DEV_OPERATOR_FALLBACK = "dev-insecure-operator-secret-change-me";

export function getServerSecret(): string {
  const s = getOptionalSecret();
  if (s) return s;
  throw new Error("ADMIN_SECRET must be set to a strong value in production.");
}

/**
 * Like getServerSecret but returns null instead of throwing when unset in
 * production. Used for non-security-critical signing (the returning-client
 * cookie) that should degrade gracefully rather than break public flows.
 */
export function getOptionalSecret(): string | null {
  const s = process.env.ADMIN_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") return null;
  return s || DEV_FALLBACK; // dev/test only
}

/** The configured staff password, or null if it must not be used (prod + unset). */
export function getAdminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  if (p) return p;
  if (process.env.NODE_ENV === "production") return null; // disabled until configured
  return "letmein"; // dev/test only
}

// ── Operator (platform super-admin) secrets ─────────────────────────────────

/** Secret signing the operator console session. Fails closed in production. */
export function getOperatorSecret(): string {
  const s = getOptionalOperatorSecret();
  if (s) return s;
  throw new Error("OPERATOR_SECRET must be set to a strong value in production.");
}

export function getOptionalOperatorSecret(): string | null {
  const s = process.env.OPERATOR_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") return null;
  return s || DEV_OPERATOR_FALLBACK; // dev/test only
}

/** The operator console password, or null if it must not be used (prod + unset). */
export function getOperatorPassword(): string | null {
  const p = process.env.OPERATOR_PASSWORD;
  if (p) return p;
  if (process.env.NODE_ENV === "production") return null; // disabled until configured
  return "operator"; // dev/test only
}

// ── Per-clinic staff password hashing (scrypt) ──────────────────────────────

/** Hash a per-clinic staff password for storage in the business config. */
export function hashStaffPassword(plain: string): { hash: string; algo: "scrypt" } {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, 64).toString("hex");
  return { hash: `${salt}:${derived}`, algo: "scrypt" };
}

/** Constant-time verify of a staff password against its stored scrypt hash. */
export function verifyStaffPassword(
  plain: string,
  stored: { hash: string; algo?: string } | undefined | null,
): boolean {
  if (!stored?.hash) return false;
  const [salt, key] = stored.hash.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(plain, salt, 64);
  const expected = Buffer.from(key, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
