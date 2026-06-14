import { describe, expect, it } from "vitest";
import { MemoryRepo } from "@/lib/repo/memory";
import type { Business } from "@/lib/types";
import {
  buildBookingInvite,
  bookingConfirmationTemplate,
  contactNotificationTemplate,
  emailConfigured,
  notifyBookingConfirmed,
  reminderTemplate,
  sendEmail,
} from "@/lib/email";

const biz = async () => (await new MemoryRepo().getBusinessBySlug("paws-and-care")) as Business;

describe("email", () => {
  it("uses the console outbox when no API key is set", async () => {
    delete process.env.RESEND_API_KEY;
    expect(emailConfigured()).toBe(false);
    const r = await sendEmail({ to: "a@b.com", subject: "hi", html: "<p>hi</p>", text: "hi" });
    expect(r).toEqual({ ok: true, provider: "console" });
  });

  it("builds a booking confirmation with details and escapes HTML", async () => {
    const tpl = bookingConfirmationTemplate(await biz(), {
      clientName: "Sara Lopez",
      service: "Wellness Exam",
      when: "Friday at 1:00 PM",
      withName: "Dr. Reyes",
      price: "$65",
      petName: "Bella<x>",
    });
    expect(tpl.subject).toContain("Wellness Exam");
    expect(tpl.text).toContain("Friday at 1:00 PM");
    expect(tpl.html).toContain("Bella&lt;x&gt;"); // escaped
    expect(tpl.html).not.toContain("Bella<x>");
  });

  it("builds reminder and contact templates", async () => {
    const b = await biz();
    expect(reminderTemplate(b, { clientName: "Sara", service: "Vaccination", when: "tomorrow 2pm", withName: "Dr. Patel" }).subject).toContain("Vaccination");
    const c = contactNotificationTemplate(b, { name: "Tom", email: "t@e.com", message: "Hello there" });
    expect(c.text).toContain("t@e.com");
    expect(c.html).toContain("Tom");
  });

  it("notifyBookingConfirmed is a no-op without an address", async () => {
    await expect(
      notifyBookingConfirmed(await biz(), null, { clientName: "X", service: "Y", when: "Z", withName: "W" }),
    ).resolves.toBeUndefined();
  });

  it("builds a calendar invite attachment when given the appointment times", async () => {
    const invite = buildBookingInvite(await biz(), "sara@example.com", {
      clientName: "Sara Lopez",
      service: "Wellness Exam",
      when: "Friday at 1:00 PM",
      withName: "Dr. Reyes",
      petName: "Bella",
      appointmentId: "appt_1",
      startISO: "2026-06-16T13:00:00.000Z",
      endISO: "2026-06-16T13:30:00.000Z",
    });
    expect(invite).not.toBeNull();
    expect(invite!.filename).toBe("invite.ics");
    expect(invite!.contentType).toContain("text/calendar");
    const decoded = Buffer.from(invite!.content, "base64").toString("utf8");
    expect(decoded).toContain("BEGIN:VEVENT");
    expect(decoded).toContain("UID:appt-appt_1@paws-and-care");
    expect(decoded).toContain("DTSTART:20260616T130000Z");
    expect(decoded).toContain("ATTENDEE");
  });

  it("returns no invite when the times are missing", async () => {
    expect(
      buildBookingInvite(await biz(), "sara@example.com", {
        clientName: "Sara",
        service: "Wellness Exam",
        when: "Friday",
        withName: "Dr. Reyes",
      }),
    ).toBeNull();
  });
});
