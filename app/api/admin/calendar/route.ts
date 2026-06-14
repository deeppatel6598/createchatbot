import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { calendarConfigured, defaultCalendarId } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/calendar — whether Google Calendar sync is configured. */
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  const configured = calendarConfigured();
  return NextResponse.json({
    data: { configured, calendarId: configured ? defaultCalendarId() : null },
  });
}
