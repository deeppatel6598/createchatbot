import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE, isAuthed, sessionToken, verifyPassword } from "@/lib/admin-auth";
import { hashStaffPassword } from "@/lib/secret";
import type { Business } from "@/lib/types";

function biz(staffAuth?: { hash: string; algo: "scrypt" }): Business {
  return {
    id: "biz_a",
    slug: "a",
    name: "A",
    vertical: "generic",
    config: {
      timezone: "UTC",
      assistantName: "Ada",
      branding: { primary: "#000", accent: "#fff" },
      voice: { displayName: "Ada", gender: "neutral", description: "", provider: "webspeech", rate: 1, pitch: 1 },
      tone: [],
      ...(staffAuth ? { staffAuth } : {}),
    },
  };
}

describe("admin auth", () => {
  it("falls back to the global password when a clinic has no staff hash", () => {
    expect(verifyPassword("letmein", biz())).toBe(true);
    expect(verifyPassword("wrong", biz())).toBe(false);
  });

  it("uses the clinic's own staff password hash when set", () => {
    const b = biz(hashStaffPassword("clinic-pass"));
    expect(verifyPassword("clinic-pass", b)).toBe(true);
    expect(verifyPassword("letmein", b)).toBe(false);
  });

  it("binds the session token to a business", () => {
    const a = sessionToken("biz_a");
    expect(a.startsWith("biz_a.")).toBe(true);
    expect(sessionToken("biz_a")).toBe(a);
    expect(sessionToken("biz_b")).not.toBe(a);
  });

  it("rejects a session cookie issued for another clinic", () => {
    const req = new NextRequest("http://localhost/api/admin/bookings", {
      headers: { cookie: `${ADMIN_COOKIE}=${sessionToken("biz_a")}` },
    });
    expect(isAuthed(req, "biz_a")).toBe(true);
    expect(isAuthed(req, "biz_b")).toBe(false);
  });
});
