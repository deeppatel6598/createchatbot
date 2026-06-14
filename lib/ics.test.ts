import { describe, expect, it } from "vitest";
import { buildICS, escapeICSText, toICSDate } from "@/lib/ics";

describe("ICS primitives", () => {
  it("formats instants as UTC iCalendar stamps", () => {
    expect(toICSDate("2026-06-16T13:00:00.000Z")).toBe("20260616T130000Z");
    expect(toICSDate("2026-01-02T03:04:05Z")).toBe("20260102T030405Z");
  });

  it("escapes commas, semicolons, backslashes, and newlines per RFC 5545", () => {
    expect(escapeICSText("Reyes, Amelia; DVM\\Clinic\nroom 2")).toBe(
      "Reyes\\, Amelia\\; DVM\\\\Clinic\\nroom 2",
    );
  });
});

describe("buildICS", () => {
  const base = {
    uid: "appt-123@paws-and-care",
    summary: "Wellness Exam for Bella — Paws & Care",
    startISO: "2026-06-16T13:00:00.000Z",
    endISO: "2026-06-16T13:30:00.000Z",
    description: "Your Wellness Exam with Dr. Amelia Reyes.",
    location: "Paws & Care Veterinary Clinic",
    organizerEmail: "appointments@paws.example",
    organizerName: "Paws & Care",
    attendeeEmail: "sara@example.com",
    attendeeName: "Sara Lopez",
    dtstampISO: "2026-06-14T10:00:00.000Z",
  };

  it("produces a well-formed VCALENDAR/VEVENT with required properties", () => {
    const ics = buildICS(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:appt-123@paws-and-care");
    expect(ics).toContain("DTSTART:20260616T130000Z");
    expect(ics).toContain("DTEND:20260616T133000Z");
    expect(ics).toContain("DTSTAMP:20260614T100000Z");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("SEQUENCE:0");
    // ORGANIZER/ATTENDEE may be line-folded, so check against the unfolded form.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("ORGANIZER;CN=Paws & Care:mailto:appointments@paws.example");
    expect(unfolded).toContain("ATTENDEE;CN=Sara Lopez;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:sara@example.com");
  });

  it("uses CRLF line endings throughout", () => {
    const ics = buildICS(base);
    // No bare LF (every LF is preceded by CR).
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("supports cancellations with a bumped sequence", () => {
    const ics = buildICS({ ...base, method: "CANCEL", status: "CANCELLED", sequence: 1 });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:1");
  });

  it("folds long content lines at 75 octets with a leading-space continuation", () => {
    const long = "x".repeat(200);
    const ics = buildICS({ ...base, description: long });
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    // The unfolded description survives a round-trip (continuations rejoin).
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`DESCRIPTION:${long}`);
  });

  it("omits optional fields cleanly when not provided", () => {
    const ics = buildICS({
      uid: "u1",
      summary: "Vaccination",
      startISO: base.startISO,
      endISO: base.endISO,
    });
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("ATTENDEE");
  });
});
