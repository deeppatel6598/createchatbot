import { NextRequest, NextResponse } from "next/server";
import { loadContext, slugFromRequest } from "@/lib/context";
import { dispatchTool } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/availability?service=Wellness%20Exam&days=7 — real open slots. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const service = url.searchParams.get("service") ?? "";
  const days = Number(url.searchParams.get("days")) || 7;
  if (!service) {
    return NextResponse.json({ error: { code: "validation_error", message: "service is required" } }, { status: 422 });
  }
  const ctx = await loadContext(slugFromRequest(req)).catch(() => null);
  if (!ctx) return NextResponse.json({ error: { code: "not_found", message: "Unknown clinic" } }, { status: 404 });
  const result = await dispatchTool(ctx.repo, ctx.business, "check_availability", { service_name: service, days });
  return NextResponse.json({ data: result.data ?? { service, slots: [] } });
}
