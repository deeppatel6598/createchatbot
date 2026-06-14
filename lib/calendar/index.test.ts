import { afterEach, describe, expect, it } from "vitest";
import { MemoryRepo } from "@/lib/repo/memory";
import type { Appointment, Business, Resource, Service } from "@/lib/types";
import { getAvailableSlots } from "@/lib/domain/availability";
import { bookAppointment } from "@/lib/domain/booking";
import {
  appointmentEvent,
  busyByResource,
  calendarConfigured,
  onBookingCancelled,
  onBookingCreated,
} from "@/lib/calendar";

const GOOGLE_ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_CALENDAR_ID"];
afterEach(() => {
  for (const k of GOOGLE_ENV) delete process.env[k];
});

async function setup() {
  const repo = new MemoryRepo();
  const business = (await repo.getBusinessBySlug("paws-and-care")) as Business;
  const services = await repo.listServices(business.id);
  const wellness = services.find((s) => s.name === "Wellness Exam")!;
  const resources = await repo.listResources(business.id);
  return { repo, business, wellness, resources };
}

describe("appointmentEvent", () => {
  it("builds a summary and description from the appointment, with the tenant timezone", async () => {
    const { business } = await setup();
    const appt: Appointment = {
      id: "a1",
      businessId: business.id,
      clientId: "c1",
      resourceId: "res_reyes",
      serviceId: "svc_wellness",
      startsAt: "2026-06-16T13:00:00.000Z",
      endsAt: "2026-06-16T13:30:00.000Z",
      status: "CONFIRMED",
      notes: "annual checkup",
      attributes: { petName: "Bella" },
    };
    const service: Service = { id: "svc_wellness", businessId: business.id, name: "Wellness Exam", durationMin: 30 };
    const resource: Resource = { id: "res_reyes", businessId: business.id, name: "Dr. Amelia Reyes" };
    const client = { id: "c1", businessId: business.id, name: "Sara Lopez", phone: "555-111-2222", email: "sara@x.com" };

    const ev = appointmentEvent(business, appt, service, resource, client);
    expect(ev.summary).toContain("Wellness Exam");
    expect(ev.summary).toContain("Bella");
    expect(ev.summary).toContain("Sara Lopez");
    expect(ev.description).toContain("Phone: 555-111-2222");
    expect(ev.description).toContain("Dr. Amelia Reyes");
    expect(ev.timeZone).toBe(business.config.timezone);
    expect(ev.attendeeEmail).toBe("sara@x.com");
  });
});

describe("best-effort no-ops when calendar is unconfigured", () => {
  it("reports unconfigured and the sync helpers do nothing (and never throw)", async () => {
    const { repo, business, wellness } = await setup();
    expect(calendarConfigured()).toBe(false);
    const slots = await getAvailableSlots(repo, business, wellness, { days: 12, max: 12 });
    const result = await bookAppointment(repo, business, {
      clientName: "Sara",
      phone: "555-111-2222",
      serviceName: "Wellness Exam",
      startISO: slots[0].iso,
    });

    // No network is attempted and no event id is recorded.
    await onBookingCreated(repo, business, result.appointment, result.service, result.resource, result.client);
    await onBookingCancelled(repo, business, result.appointment);
    const after = await repo.listAppointments(business.id, { includeCancelled: true });
    expect(after.find((a) => a.id === result.appointment.id)?.googleEventId ?? null).toBeNull();

    // free/busy returns nothing, so availability is unchanged.
    const resources = await repo.listResources(business.id);
    expect(await busyByResource(resources, slots[0].iso, slots[11].iso)).toEqual({});
  });
});

describe("free/busy folds into offered slots", () => {
  it("hides times that overlap a resource's external calendar", async () => {
    const { repo, business, wellness, resources } = await setup();
    const open = await getAvailableSlots(repo, business, wellness, { days: 12, max: 12 });
    const target = open[0].iso;
    const end = new Date(new Date(target).getTime() + wellness.durationMin * 60_000).toISOString();

    // Mark every resource busy across the target slot on their external calendar.
    const extraBusy = Object.fromEntries(resources.map((r) => [r.id, [{ startISO: target, endISO: end }]]));
    const filtered = await getAvailableSlots(repo, business, wellness, { days: 12, max: 12, extraBusy });

    expect(open.some((s) => s.iso === target)).toBe(true);
    expect(filtered.some((s) => s.iso === target)).toBe(false);
  });
});
