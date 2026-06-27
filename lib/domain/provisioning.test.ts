import { describe, expect, it } from "vitest";
import { MemoryRepo } from "@/lib/repo/memory";
import { ConflictError, type Vertical } from "@/lib/types";
import { provisionBusiness, slugify, type ProvisionBusinessInput } from "@/lib/domain/provisioning";
import { verifyStaffPassword } from "@/lib/secret";

function input(overrides: Partial<ProvisionBusinessInput> = {}): ProvisionBusinessInput {
  return {
    identity: { name: "Bright Smile Dental", slug: "bright-smile", vertical: "dental" as Vertical },
    config: {
      timezone: "America/New_York",
      assistantName: "Mia",
      branding: { primary: "#1166CC", accent: "#22CCAA" },
      voice: { displayName: "Mia", gender: "female", description: "calm and clear", provider: "webspeech", rate: 1, pitch: 1 },
      tone: ["calm", "professional"],
      hoursText: "Mon–Fri 9am–5pm",
      policies: ["24 hours' notice for cancellations."],
      clientNoun: { singular: "patient", plural: "patients" },
    },
    staffPassword: "clinic-secret",
    contact: { address: "10 Main St, Springfield", phone: "(555) 123-4567", mapUrl: "https://maps.example/x" },
    services: [
      { name: "Cleaning", durationMin: 30, priceCents: 12000, description: "Routine cleaning." },
      { name: "Whitening", durationMin: 45 },
    ],
    resources: [
      { name: "Dr. Vega", role: "Dentist", availability: [{ weekday: 1, startMin: 540, endMin: 1020 }] },
    ],
    autoFaq: true,
    ...overrides,
  };
}

describe("slugify", () => {
  it("makes a url-safe slug", () => {
    expect(slugify("Paws & Care Veterinary Clinic!")).toBe("paws-care-veterinary-clinic");
    expect(slugify("  Bright  Smile  ")).toBe("bright-smile");
  });
});

describe("provisionBusiness", () => {
  it("creates a tenant with its services, team, availability, and knowledge", async () => {
    const repo = new MemoryRepo();
    const biz = await provisionBusiness(repo, input());

    expect(biz.slug).toBe("bright-smile");
    expect(biz.vertical).toBe("dental");

    const services = await repo.listServices(biz.id);
    expect(services.map((s) => s.name).sort()).toEqual(["Cleaning", "Whitening"]);

    const resources = await repo.listResources(biz.id);
    expect(resources).toHaveLength(1);
    const rules = await repo.listAvailabilityRules(resources[0].id);
    expect(rules).toHaveLength(1);
    expect(rules[0].weekday).toBe(1);
  });

  it("hashes the staff password into the config and never stores it raw", async () => {
    const repo = new MemoryRepo();
    const biz = await provisionBusiness(repo, input());
    const stored = (await repo.getBusinessById(biz.id))!;
    expect(stored.config.staffAuth?.algo).toBe("scrypt");
    expect(JSON.stringify(stored.config)).not.toContain("clinic-secret");
    expect(verifyStaffPassword("clinic-secret", stored.config.staffAuth)).toBe(true);
    expect(verifyStaffPassword("wrong", stored.config.staffAuth)).toBe(false);
  });

  it("keeps the configured client-noun and auto-generates starter FAQ", async () => {
    const repo = new MemoryRepo();
    const biz = await provisionBusiness(repo, input());
    expect((await repo.getBusinessById(biz.id))!.config.clientNoun).toEqual({ singular: "patient", plural: "patients" });

    const location = await repo.searchKnowledge(biz.id, "where located address");
    expect(location.some((k) => k.kind === "LOCATION" && k.body.includes("10 Main St"))).toBe(true);
    const pricing = await repo.searchKnowledge(biz.id, "cost price");
    expect(pricing.some((k) => k.kind === "PRICING" && k.body.includes("$120"))).toBe(true);
  });

  it("isolates tenants and rejects a duplicate slug", async () => {
    const repo = new MemoryRepo();
    await provisionBusiness(repo, input());
    // The seeded Paws & Care clinic is untouched and separate.
    expect(await repo.getBusinessBySlug("paws-and-care")).not.toBeNull();
    expect((await repo.listBusinesses()).length).toBe(2);

    await expect(provisionBusiness(repo, input())).rejects.toBeInstanceOf(ConflictError);
  });
});
