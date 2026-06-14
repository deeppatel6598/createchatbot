import type {
  Appointment,
  Business,
  BusyInterval,
  Client,
  Repo,
  Resource,
  Service,
} from "@/lib/types";
import {
  calendarConfigured,
  createCalendarEvent,
  deleteCalendarEvent,
  defaultCalendarId,
  fetchFreeBusy,
  type CalendarEventInput,
} from "./google";

export { calendarConfigured, defaultCalendarId } from "./google";

/**
 * Calendar sync orchestration. Each helper is best-effort: it returns instantly
 * when calendar sync isn't configured (zero overhead for the keyless demo), and
 * it never throws into the booking flow — a calendar hiccup must never fail or
 * block a booking (the same rule the email layer follows). Persisting the synced
 * event id needs the Repo port, so unlike the pure provider these take `repo`.
 */

function calendarIdFor(resource: Resource | null | undefined): string {
  return resource?.googleCalId || defaultCalendarId();
}

/** Build the Google Calendar event for an appointment. Pure + testable. */
export function appointmentEvent(
  business: Business,
  appt: Appointment,
  service: Service,
  resource: Resource,
  client: Client | null,
): CalendarEventInput {
  const petName = (appt.attributes as { petName?: string } | null)?.petName;
  const summary = [service.name, petName ? `(${petName})` : null, client?.name ? `— ${client.name}` : null]
    .filter(Boolean)
    .join(" ");
  const description = [
    `Service: ${service.name}`,
    `With: ${resource.name}`,
    client?.name ? `Client: ${client.name}` : null,
    client?.phone ? `Phone: ${client.phone}` : null,
    petName ? `Pet: ${petName}` : null,
    appt.notes ? `Notes: ${appt.notes}` : null,
    `Booked via ${business.config.assistantName}.`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    summary,
    description,
    startISO: appt.startsAt,
    endISO: appt.endsAt,
    timeZone: business.config.timezone,
    attendeeEmail: client?.email ?? null,
  };
}

/** Look up the service, resource, and client an appointment refers to. */
async function expand(
  repo: Repo,
  business: Business,
  appt: Appointment,
): Promise<{ service?: Service; resource?: Resource; client: Client | null }> {
  const [services, resources, client] = await Promise.all([
    repo.listServices(business.id),
    repo.listResources(business.id),
    repo.getClientById(business.id, appt.clientId),
  ]);
  return {
    service: services.find((s) => s.id === appt.serviceId),
    resource: resources.find((r) => r.id === appt.resourceId),
    client,
  };
}

/** Push a new booking to the calendar and persist its event id. Best-effort. */
export async function onBookingCreated(
  repo: Repo,
  business: Business,
  appt: Appointment,
  service: Service,
  resource: Resource,
  client: Client | null,
): Promise<void> {
  if (!calendarConfigured()) return;
  try {
    const eventId = await createCalendarEvent(
      calendarIdFor(resource),
      appointmentEvent(business, appt, service, resource, client),
    );
    if (eventId) await repo.updateAppointment(appt.id, { googleEventId: eventId });
  } catch (err) {
    console.error("calendar sync (create) failed", err);
  }
}

/**
 * Reflect a reschedule on the calendar: remove the old event and create a fresh
 * one for the new appointment, persisting the new event id. Best-effort.
 */
export async function onBookingRescheduled(
  repo: Repo,
  business: Business,
  previous: Appointment,
  next: Appointment,
): Promise<void> {
  if (!calendarConfigured()) return;
  try {
    const { service, resource, client } = await expand(repo, business, next);
    const prevResource =
      previous.resourceId === next.resourceId
        ? resource
        : (await repo.listResources(business.id)).find((r) => r.id === previous.resourceId);
    if (previous.googleEventId) {
      await deleteCalendarEvent(calendarIdFor(prevResource), previous.googleEventId);
    }
    if (service && resource) {
      const eventId = await createCalendarEvent(
        calendarIdFor(resource),
        appointmentEvent(business, next, service, resource, client),
      );
      if (eventId) await repo.updateAppointment(next.id, { googleEventId: eventId });
    }
  } catch (err) {
    console.error("calendar sync (reschedule) failed", err);
  }
}

/** Remove a cancelled booking's event. Best-effort. */
export async function onBookingCancelled(
  repo: Repo,
  business: Business,
  appt: Appointment,
): Promise<void> {
  if (!calendarConfigured() || !appt.googleEventId) return;
  try {
    const { resource } = await expand(repo, business, appt);
    await deleteCalendarEvent(calendarIdFor(resource), appt.googleEventId);
  } catch (err) {
    console.error("calendar sync (cancel) failed", err);
  }
}

/**
 * Busy intervals per resource id over a window, from each resource's Google
 * calendar. Returns {} when unconfigured so availability is unaffected.
 */
export async function busyByResource(
  resources: Resource[],
  fromISO: string,
  toISO: string,
): Promise<Record<string, BusyInterval[]>> {
  if (!calendarConfigured() || resources.length === 0) return {};
  try {
    const calIds = [...new Set(resources.map(calendarIdFor))];
    const byCalendar = await fetchFreeBusy(calIds, fromISO, toISO);
    const out: Record<string, BusyInterval[]> = {};
    for (const r of resources) out[r.id] = byCalendar[calendarIdFor(r)] ?? [];
    return out;
  } catch (err) {
    console.error("calendar free/busy failed", err);
    return {};
  }
}
