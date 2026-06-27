import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { loadContext, slugFromRequest } from "@/lib/context";
import { calendarConfigured, defaultCalendarId } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/calendar — whether Google Calendar sync is configured. */
export async function GET(req: NextRequest) {
  const ctx = await loadContext(slugFromRequest(req)).catch(() => null);
  if (!ctx) return NextResponse.json({ error: { code: "not_found", message: "Unknown clinic" } }, { status: 404 });
  if (!isAuthed(req, ctx.business.id)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  const configured = calendarConfigured();
  return NextResponse.json({
    data: { configured, calendarId: configured ? defaultCalendarId() : null },
  });
}
