import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { getOperatorPassword, getOperatorSecret } from "./secret";

/**
 * Operator (platform super-admin) auth. Mirrors the staff admin gate but with a
 * separate password and cookie: the operator runs the onboarding console and can
 * create/list clinics. Secrets fail closed in production (see ./secret).
 */
export const OPERATOR_COOKIE = "operator_session";
export const OPERATOR_MAX_AGE = 60 * 60 * 8; // 8 hours

export function operatorSessionToken(): string {
  return createHmac("sha256", getOperatorSecret()).update("operator-session-v1").digest("hex");
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
  const token = req.cookies.get(OPERATOR_COOKIE)?.value;
  return Boolean(token && safeEqual(token, operatorSessionToken()));
}
