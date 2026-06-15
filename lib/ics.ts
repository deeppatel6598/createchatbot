/**
 * Minimal RFC 5545 iCalendar (.ics) builder — pure and dependency-free, so a
 * standards-compliant invite can be attached to the booking confirmation email
 * and the client adds the visit to Apple / Google / Outlook in one tap. Works
 * with zero setup (no keys); the only consumer is the email layer.
 *
 * Care is taken with the things calendar clients are picky about: CRLF line
 * endings, UTC timestamps, TEXT escaping, and 75-octet line folding.
 */

export interface ICSEvent {
  /** Stable, globally-unique id; reused across updates/cancellations. */
  uid: string;
  summary: string;
  startISO: string;
  endISO: string;
  description?: string;
  location?: string;
  organizerEmail?: string;
  organizerName?: string;
  attendeeEmail?: string | null;
  attendeeName?: string;
  method?: "REQUEST" | "CANCEL";
  status?: "CONFIRMED" | "CANCELLED";
  /** Bumped on each update so clients accept the newer version. */
  sequence?: number;
  /** Override the DTSTAMP (mainly for deterministic tests). */
  dtstampISO?: string;
}

const PRODID = "-//Paws & Care//Sofia Concierge//EN";

/** ISO instant → iCalendar UTC stamp, e.g. 2026-06-16T13:00:00Z → 20260616T130000Z. */
export function toICSDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/** Escape a TEXT value per RFC 5545 §3.3.11 (backslash, comma, semicolon, newline). */
export function escapeICSText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets; continuation lines begin with a space (§3.1). */
function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const segments: string[] = [];
  let current = "";
  for (const ch of line) {
    const candidate = current + ch;
    if (Buffer.byteLength(candidate, "utf8") > 75) {
      segments.push(current);
      current = " " + ch; // continuation starts with a single space
    } else {
      current = candidate;
    }
  }
  if (current) segments.push(current);
  return segments.join("\r\n");
}

/** Build a complete VCALENDAR string for a single event. */
export function buildICS(ev: ICSEvent): string {
  const method = ev.method ?? "REQUEST";
  const status = ev.status ?? "CONFIRMED";
  const sequence = ev.sequence ?? 0;
  const dtstamp = ev.dtstampISO ?? new Date().toISOString();

  const organizer = ev.organizerEmail
    ? `ORGANIZER${ev.organizerName ? `;CN=${escapeICSText(ev.organizerName)}` : ""}:mailto:${ev.organizerEmail}`
    : null;
  const attendee = ev.attendeeEmail
    ? `ATTENDEE${ev.attendeeName ? `;CN=${escapeICSText(ev.attendeeName)}` : ""};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${ev.attendeeEmail}`
    : null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${toICSDate(dtstamp)}`,
    `DTSTART:${toICSDate(ev.startISO)}`,
    `DTEND:${toICSDate(ev.endISO)}`,
    `SUMMARY:${escapeICSText(ev.summary)}`,
    ev.description ? `DESCRIPTION:${escapeICSText(ev.description)}` : null,
    ev.location ? `LOCATION:${escapeICSText(ev.location)}` : null,
    organizer,
    attendee,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => Boolean(l));

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
