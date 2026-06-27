import type {
  BrandConfig,
  Business,
  BusinessGraphInput,
  KnowledgeKind,
  Repo,
  Vertical,
} from "@/lib/types";
import { hashStaffPassword } from "@/lib/secret";

/**
 * Clinic onboarding (operator console). Turns the operator's submitted form into
 * a `BusinessGraphInput` — hashing the staff password into the config and,
 * optionally, auto-generating starter FAQ/knowledge from the contact details,
 * hours, and services — then creates the whole tenant atomically via the repo.
 */

export interface ProvisionServiceInput {
  name: string;
  durationMin: number;
  priceCents?: number | null;
  description?: string | null;
}

export interface ProvisionResourceInput {
  name: string;
  role?: string | null;
  googleCalId?: string | null;
  availability: Array<{ weekday: number; startMin: number; endMin: number }>;
}

export interface ProvisionKnowledgeInput {
  kind: KnowledgeKind;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
}

export interface ProvisionBusinessInput {
  identity: { name: string; slug: string; vertical: Vertical };
  /** Brand config minus staffAuth (derived from staffPassword below). */
  config: Omit<BrandConfig, "staffAuth">;
  staffPassword: string;
  contact?: { address?: string; phone?: string; email?: string; mapUrl?: string };
  services: ProvisionServiceInput[];
  resources: ProvisionResourceInput[];
  knowledge?: ProvisionKnowledgeInput[];
  /** Generate starter LOCATION/HOURS/SERVICE/PRICING/POLICY entries. */
  autoFaq?: boolean;
}

/** URL-safe slug from a clinic name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const money = (cents?: number | null) =>
  cents == null ? null : `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** Synthesize starter knowledge from the structured onboarding fields. */
export function buildAutoFaq(input: ProvisionBusinessInput): ProvisionKnowledgeInput[] {
  const entries: ProvisionKnowledgeInput[] = [];
  const c = input.contact;
  if (c?.address) {
    entries.push({
      kind: "LOCATION",
      title: "Where are you located?",
      body: `We're at ${c.address}.${c.phone ? ` You can reach us at ${c.phone}.` : ""}`,
      metadata: {
        ...(c.mapUrl ? { mapUrl: c.mapUrl } : {}),
        ...(c.phone ? { phone: c.phone } : {}),
      },
    });
  }
  if (input.config.hoursText) {
    entries.push({ kind: "HOURS", title: "What are your opening hours?", body: input.config.hoursText });
  }
  if (input.services.length) {
    entries.push({
      kind: "SERVICE",
      title: "What services do you offer?",
      body: `We offer ${input.services.map((s) => s.name).join(", ")}.`,
    });
    const priced = input.services.filter((s) => s.priceCents != null);
    if (priced.length) {
      entries.push({
        kind: "PRICING",
        title: "How much do visits cost?",
        body: `A guide to our pricing: ${priced.map((s) => `${s.name} ${money(s.priceCents)}`).join(", ")}. We'll always confirm any costs with you first.`,
      });
    }
  }
  if (input.config.policies?.length) {
    entries.push({ kind: "POLICY", title: "What are your policies?", body: input.config.policies.join(" ") });
  }
  return entries;
}

/** Provision a complete clinic from an operator submission. */
export async function provisionBusiness(
  repo: Repo,
  input: ProvisionBusinessInput,
): Promise<Business> {
  const config: BrandConfig = {
    ...input.config,
    staffAuth: hashStaffPassword(input.staffPassword),
  };
  const knowledge: ProvisionKnowledgeInput[] = [
    ...(input.knowledge ?? []),
    ...(input.autoFaq ? buildAutoFaq(input) : []),
  ];
  const graph: BusinessGraphInput = {
    slug: input.identity.slug,
    name: input.identity.name,
    vertical: input.identity.vertical,
    config,
    services: input.services,
    resources: input.resources,
    knowledge,
  };
  return repo.createBusinessGraph(graph);
}
