import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthed } from "@/lib/admin-auth";
import { loadContext, slugFromRequest } from "@/lib/context";
import { rescheduleAppointment } from "@/lib/domain/booking";
import { formatDateTime } from "@/lib/domain/time";
import { ConflictError, NotFoundError } from "@/lib/types";
import { onBookingCancelled, onBookingRescheduled } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({ newStartISO: z.string().datetime() });

/** PATCH /api/admin/bookings/:id — reschedule to a new time. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadContext(slugFromRequest(req)).catch(() => null);
  if (!ctx) return NextResponse.json({ error: { code: "not_found", message: "Unknown clinic" } }, { status: 404 });
  const { repo, business } = ctx;
  if (!isAuthed(req, business.id)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  const { id } = await params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error", message: "newStartISO required" } }, { status: 422 });
  }

  const all = await repo.listAppointments(business.id, { includeCancelled: true });
  const appt = all.find((a) => a.id === id);
  if (!appt) return NextResponse.json({ error: { code: "not_found", message: "Appointment not found" } }, { status: 404 });

  try {
    const moved = await rescheduleAppointment(repo, business, appt, parsed.data.newStartISO);
    // Reflect the move on the calendar (best-effort; doesn't block the response).
    await onBookingRescheduled(repo, business, appt, moved);
    return NextResponse.json({ data: { id: moved.id, when: formatDateTime(moved.startsAt), startISO: moved.startsAt } });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: { code: "slot_taken", message: err.message } }, { status: 409 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { code: "not_found", message: err.message } }, { status: 404 });
    console.error("admin reschedule error", err);
    return NextResponse.json({ error: { code: "internal_error", message: "Could not reschedule." } }, { status: 500 });
  }
}

/** DELETE /api/admin/bookings/:id — cancel the appointment. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadContext(slugFromRequest(req)).catch(() => null);
  if (!ctx) return NextResponse.json({ error: { code: "not_found", message: "Unknown clinic" } }, { status: 404 });
  const { repo, business } = ctx;
  if (!isAuthed(req, business.id)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  const { id } = await params;
  // Verify the appointment belongs to this tenant before mutating.
  const all = await repo.listAppointments(business.id, { includeCancelled: true });
  const existing = all.find((a) => a.id === id);
  if (!existing) return NextResponse.json({ error: { code: "not_found", message: "Appointment not found" } }, { status: 404 });

  try {
    const cancelled = await repo.updateAppointment(id, { status: "CANCELLED" });
    await onBookingCancelled(repo, business, existing);
    return NextResponse.json({ data: { id: cancelled.id, status: cancelled.status } });
  } catch {
    return NextResponse.json({ error: { code: "internal_error", message: "Could not cancel appointment." } }, { status: 500 });
  }
}
