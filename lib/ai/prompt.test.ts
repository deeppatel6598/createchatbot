import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import type { Business, Service } from "@/lib/types";

function business(overrides: Partial<Business> = {}): Business {
  return {
    id: "b1",
    slug: "demo",
    name: "Demo Co",
    vertical: "veterinary",
    config: {
      timezone: "America/New_York",
      assistantName: "Sofia",
      branding: { primary: "#000", accent: "#fff" },
      voice: { displayName: "Sofia", gender: "female", description: "warm", provider: "webspeech", rate: 1, pitch: 1 },
      tone: ["warm"],
      hoursText: "Mon–Fri 9–5",
    },
    ...overrides,
  };
}

const services: Service[] = [{ id: "s1", businessId: "b1", name: "Checkup", durationMin: 30 }];

describe("buildSystemPrompt — configurable client noun", () => {
  it("uses 'pet' and the medical disclaimer for a veterinary clinic", () => {
    const p = buildSystemPrompt(business(), services);
    expect(p).toContain("their pets");
    expect(p).toContain("medical professional");
    expect(p).toContain("can't give medical advice");
  });

  it("uses the clinic's configured noun and softens the rule for a salon", () => {
    const salon = business({
      vertical: "salon",
      config: {
        ...business().config,
        clientNoun: { singular: "client", plural: "clients" },
      },
    });
    const p = buildSystemPrompt(salon, services);
    expect(p).toContain("their clients");
    expect(p).not.toContain("their pets");
    expect(p).not.toContain("NEVER diagnose");
    expect(p).toContain("concierge duties");
  });

  it("defaults a dental clinic to 'patient' and keeps the medical disclaimer", () => {
    const dental = business({ vertical: "dental" });
    const p = buildSystemPrompt(dental, services);
    expect(p).toContain("their patients");
    expect(p).toContain("medical professional");
  });
});
