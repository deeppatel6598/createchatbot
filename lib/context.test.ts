import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { loadContext, slugFromRequest } from "@/lib/context";
import { NotFoundError } from "@/lib/types";

describe("tenant resolution", () => {
  it("resolves the seeded clinic by slug", async () => {
    const { business } = await loadContext("paws-and-care");
    expect(business.slug).toBe("paws-and-care");
  });

  it("falls back to the env default when no slug is given", async () => {
    const { business } = await loadContext();
    expect(business.slug).toBe("paws-and-care");
  });

  it("throws NotFoundError for an unknown slug", async () => {
    await expect(loadContext("does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reads the active slug from the ?b= query", () => {
    expect(slugFromRequest(new NextRequest("http://x/api/business?b=foo"))).toBe("foo");
    expect(slugFromRequest(new NextRequest("http://x/api/business"))).toBeUndefined();
  });
});
