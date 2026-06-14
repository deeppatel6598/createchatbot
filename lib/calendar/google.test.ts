import { afterEach, describe, expect, it } from "vitest";
import {
  buildCreateEventRequest,
  buildDeleteEventRequest,
  buildEventResource,
  buildFreeBusyRequest,
  buildTokenRequest,
  buildUpdateEventRequest,
  calendarConfigured,
  defaultCalendarId,
  eventsUrl,
  parseFreeBusy,
} from "@/lib/calendar/google";

const GOOGLE_ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_CALENDAR_ID"];

function clearGoogleEnv() {
  for (const k of GOOGLE_ENV) delete process.env[k];
}

afterEach(clearGoogleEnv);

const sampleEvent = {
  summary: "Wellness Exam (Bella) — Sara Lopez",
  description: "Service: Wellness Exam\nPhone: 555-111-2222",
  startISO: "2026-06-16T13:00:00.000Z",
  endISO: "2026-06-16T13:30:00.000Z",
  timeZone: "America/New_York",
  attendeeEmail: "sara@example.com",
};

describe("Google Calendar config", () => {
  it("is unconfigured until all three OAuth credentials are present", () => {
    clearGoogleEnv();
    expect(calendarConfigured()).toBe(false);
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(calendarConfigured()).toBe(false); // still missing the refresh token
    process.env.GOOGLE_REFRESH_TOKEN = "refresh";
    expect(calendarConfigured()).toBe(true);
  });

  it("defaults the calendar id to 'primary'", () => {
    clearGoogleEnv();
    expect(defaultCalendarId()).toBe("primary");
    process.env.GOOGLE_CALENDAR_ID = "vet@clinic.com";
    expect(defaultCalendarId()).toBe("vet@clinic.com");
  });
});

describe("token request", () => {
  it("posts a form-encoded refresh-token grant with the configured credentials", () => {
    process.env.GOOGLE_CLIENT_ID = "client-123";
    process.env.GOOGLE_CLIENT_SECRET = "shh";
    process.env.GOOGLE_REFRESH_TOKEN = "r3fresh";
    const req = buildTokenRequest();
    expect(req.url).toBe("https://oauth2.googleapis.com/token");
    expect(req.method).toBe("POST");
    expect(req.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const params = new URLSearchParams(req.body);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("client_id")).toBe("client-123");
    expect(params.get("refresh_token")).toBe("r3fresh");
  });
});

describe("event resource", () => {
  it("maps the appointment into Google's start/end/timeZone shape", () => {
    const body = buildEventResource(sampleEvent) as Record<string, unknown>;
    expect(body.summary).toBe(sampleEvent.summary);
    expect(body.start).toEqual({ dateTime: sampleEvent.startISO, timeZone: sampleEvent.timeZone });
    expect(body.end).toEqual({ dateTime: sampleEvent.endISO, timeZone: sampleEvent.timeZone });
    expect(body.attendees).toEqual([{ email: "sara@example.com" }]);
  });

  it("omits attendees and description when not provided", () => {
    const body = buildEventResource({
      summary: "Vaccination",
      startISO: sampleEvent.startISO,
      endISO: sampleEvent.endISO,
      timeZone: sampleEvent.timeZone,
    }) as Record<string, unknown>;
    expect(body.attendees).toBeUndefined();
    expect(body.description).toBeUndefined();
  });
});

describe("event URLs and CRUD requests", () => {
  it("URL-encodes the calendar id and event id", () => {
    expect(eventsUrl("vet@clinic.com")).toContain("/calendars/vet%40clinic.com/events");
    expect(eventsUrl("primary", "evt 1")).toContain("/events/evt%201");
  });

  it("builds create/update/delete requests with auth and the right verbs", () => {
    const create = buildCreateEventRequest("primary", sampleEvent, "tok");
    expect(create.method).toBe("POST");
    expect(create.url).toContain("/calendars/primary/events?sendUpdates=none");
    expect(create.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(create.body!).summary).toBe(sampleEvent.summary);

    const update = buildUpdateEventRequest("primary", "evt1", sampleEvent, "tok");
    expect(update.method).toBe("PATCH");
    expect(update.url).toContain("/events/evt1");

    const del = buildDeleteEventRequest("primary", "evt1", "tok");
    expect(del.method).toBe("DELETE");
    expect(del.headers.Authorization).toBe("Bearer tok");
  });
});

describe("free/busy", () => {
  it("builds a freeBusy query over the window for each calendar", () => {
    const req = buildFreeBusyRequest(["a@x.com", "b@x.com"], "2026-06-16T00:00:00.000Z", "2026-06-23T00:00:00.000Z", "tok");
    expect(req.url).toBe("https://www.googleapis.com/calendar/v3/freeBusy");
    const body = JSON.parse(req.body!);
    expect(body.timeMin).toBe("2026-06-16T00:00:00.000Z");
    expect(body.items).toEqual([{ id: "a@x.com" }, { id: "b@x.com" }]);
  });

  it("parses busy intervals per calendar and tolerates missing entries", () => {
    const parsed = parseFreeBusy({
      calendars: {
        "a@x.com": { busy: [{ start: "2026-06-16T13:00:00Z", end: "2026-06-16T14:00:00Z" }] },
        "b@x.com": {},
      },
    });
    expect(parsed["a@x.com"]).toEqual([{ startISO: "2026-06-16T13:00:00Z", endISO: "2026-06-16T14:00:00Z" }]);
    expect(parsed["b@x.com"]).toEqual([]);
    expect(parseFreeBusy({})).toEqual({});
  });
});
