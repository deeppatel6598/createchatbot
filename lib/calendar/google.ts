import type { BusyInterval } from "@/lib/types";

/**
 * Google Calendar integration — server-side only. Follows the project's provider
 * pattern (email / ElevenLabs): pure, unit-tested request builders with thin
 * `fetch` wrappers, plus a keyless no-op fallback so the app runs with zero
 * setup. Synced bookings appear on the staff's real calendar, and the resources'
 * free/busy is folded into the offered slots so we never propose a time the vet
 * is already busy elsewhere.
 *
 * Auth uses the OAuth2 refresh-token grant: the business connects one Google
 * account that owns (or shares) the resource calendars, and we exchange its
 * refresh token for short-lived access tokens server-side. Configure via env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   GOOGLE_CALENDAR_ID  (default "primary")
 * A Resource may override the target calendar via its `googleCalId`.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/calendar/v3";

/** True only when all three OAuth credentials are present. */
export function calendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN,
  );
}

/** The calendar bookings sync to when a resource doesn't name its own. */
export function defaultCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  timeZone: string;
  attendeeEmail?: string | null;
}

export interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function authJsonHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** The OAuth2 refresh-token exchange. Pure — reads env, builds the request. */
export function buildTokenRequest(): HttpRequest {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    grant_type: "refresh_token",
  });
  return {
    url: TOKEN_URL,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  };
}

/** The events collection (or a single event) URL for a calendar. */
export function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

/** Build the Google Calendar event resource (the request JSON body). Pure. */
export function buildEventResource(ev: CalendarEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: ev.summary,
    start: { dateTime: ev.startISO, timeZone: ev.timeZone },
    end: { dateTime: ev.endISO, timeZone: ev.timeZone },
  };
  if (ev.description) body.description = ev.description;
  if (ev.attendeeEmail) body.attendees = [{ email: ev.attendeeEmail }];
  return body;
}

export function buildCreateEventRequest(
  calendarId: string,
  ev: CalendarEventInput,
  accessToken: string,
): HttpRequest {
  return {
    url: `${eventsUrl(calendarId)}?sendUpdates=none`,
    method: "POST",
    headers: authJsonHeaders(accessToken),
    body: JSON.stringify(buildEventResource(ev)),
  };
}

export function buildUpdateEventRequest(
  calendarId: string,
  eventId: string,
  ev: CalendarEventInput,
  accessToken: string,
): HttpRequest {
  return {
    url: `${eventsUrl(calendarId, eventId)}?sendUpdates=none`,
    method: "PATCH",
    headers: authJsonHeaders(accessToken),
    body: JSON.stringify(buildEventResource(ev)),
  };
}

export function buildDeleteEventRequest(
  calendarId: string,
  eventId: string,
  accessToken: string,
): HttpRequest {
  return {
    url: `${eventsUrl(calendarId, eventId)}?sendUpdates=none`,
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  };
}

export function buildFreeBusyRequest(
  calendarIds: string[],
  fromISO: string,
  toISO: string,
  accessToken: string,
): HttpRequest {
  return {
    url: `${API_BASE}/freeBusy`,
    method: "POST",
    headers: authJsonHeaders(accessToken),
    body: JSON.stringify({
      timeMin: fromISO,
      timeMax: toISO,
      items: calendarIds.map((id) => ({ id })),
    }),
  };
}

/** Parse a freeBusy response into busy intervals keyed by calendar id. Pure. */
export function parseFreeBusy(json: unknown): Record<string, BusyInterval[]> {
  const calendars =
    (json as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }> })
      ?.calendars ?? {};
  const out: Record<string, BusyInterval[]> = {};
  for (const [calId, v] of Object.entries(calendars)) {
    out[calId] = (v.busy ?? []).map((b) => ({ startISO: b.start, endISO: b.end }));
  }
  return out;
}

// ── Thin fetch wrappers (network) ───────────────────────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;

/** Exchange the refresh token for a cached access token, or null if unconfigured. */
async function getAccessToken(): Promise<string | null> {
  if (!calendarConfigured()) return null;
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token;
  const req = buildTokenRequest();
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("google token: no access_token");
  tokenCache = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

/** Test-only: clear the cached access token. */
export function _resetTokenCache(): void {
  tokenCache = null;
}

/** Create an event; returns the new event id (or null when unconfigured). */
export async function createCalendarEvent(
  calendarId: string,
  ev: CalendarEventInput,
): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const req = buildCreateEventRequest(calendarId, ev, token);
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  if (!res.ok) throw new Error(`google create event ${res.status}`);
  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return json.id ?? null;
}

export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  ev: CalendarEventInput,
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;
  const req = buildUpdateEventRequest(calendarId, eventId, ev, token);
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  // 404/410 mean the event is already gone — nothing to update.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`google update event ${res.status}`);
  }
}

export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;
  const req = buildDeleteEventRequest(calendarId, eventId, token);
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  // 404/410 mean it was already deleted — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`google delete event ${res.status}`);
  }
}

export async function fetchFreeBusy(
  calendarIds: string[],
  fromISO: string,
  toISO: string,
): Promise<Record<string, BusyInterval[]>> {
  const token = await getAccessToken();
  if (!token || calendarIds.length === 0) return {};
  const req = buildFreeBusyRequest(calendarIds, fromISO, toISO, token);
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  if (!res.ok) throw new Error(`google freeBusy ${res.status}`);
  return parseFreeBusy(await res.json());
}
