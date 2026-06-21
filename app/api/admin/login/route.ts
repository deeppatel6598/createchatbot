import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, sessionToken, verifyPassword } from "@/lib/admin-auth";
import { loadContext, slugFromRequest } from "@/lib/context";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  // Throttle brute-force attempts on the staff password.
  const limited = rateLimit(req, { name: "admin-login", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Incorrect password" } }, { status: 401 });
  }

  let businessId: string;
  try {
    const { business } = await loadContext(slugFromRequest(req));
    if (!verifyPassword(parsed.data.password, business)) {
      return NextResponse.json({ error: { code: "unauthorized", message: "Incorrect password" } }, { status: 401 });
    }
    businessId = business.id;
  } catch {
    return NextResponse.json({ error: { code: "not_found", message: "Unknown clinic" } }, { status: 404 });
  }

  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(ADMIN_COOKIE, sessionToken(businessId), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return res;
}
