import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OPERATOR_COOKIE, OPERATOR_MAX_AGE, operatorSessionToken, verifyOperatorPassword } from "@/lib/operator-auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ password: z.string().min(1).max(200) });

/** POST /api/operator/login — operator console sign-in. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "operator-login", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success || !verifyOperatorPassword(parsed.data.password)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Incorrect password" } }, { status: 401 });
  }
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(OPERATOR_COOKIE, operatorSessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OPERATOR_MAX_AGE,
  });
  return res;
}
