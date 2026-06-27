import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, isAuthed, sessionToken, verifyPassword } from "@/lib/admin-auth";
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

  it("binds the session token to a business and a point in time", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const a = sessionToken("biz_a", nowSec);
    expect(a.startsWith(`biz_a:${nowSec}.`)).toBe(true);
    // Same inputs → same token (deterministic HMAC).
    expect(sessionToken("biz_a", nowSec)).toBe(a);
    // Different business → different token.
    expect(sessionToken("biz_b", nowSec)).not.toBe(a);
  });

  it("accepts a valid token and rejects cross-clinic and expired tokens", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = sessionToken("biz_a", nowSec);
    const req = (t: string) =>
      new NextRequest("http://localhost/api/admin/bookings", {
        headers: { cookie: `${ADMIN_COOKIE}=${t}` },
      });

    expect(isAuthed(req(token), "biz_a")).toBe(true);
    // Cookie for another clinic must be rejected.
    expect(isAuthed(req(token), "biz_b")).toBe(false);
    // Expired token (issuedAt older than MAX_AGE) must be rejected.
    const staleToken = sessionToken("biz_a", nowSec - ADMIN_MAX_AGE - 1);
    expect(isAuthed(req(staleToken), "biz_a")).toBe(false);
  });
});
