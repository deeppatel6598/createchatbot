import type { Business, Vertical } from "@/lib/types";

/** The word a tenant uses for who/what it serves — drives assistant wording. */
export interface ClientNoun {
  singular: string;
  plural: string;
}

/** Sensible default noun per vertical when a tenant hasn't set its own. */
export function defaultClientNoun(vertical: Vertical): ClientNoun {
  switch (vertical) {
    case "veterinary":
      return { singular: "pet", plural: "pets" };
    case "dental":
      return { singular: "patient", plural: "patients" };
    case "salon":
      return { singular: "client", plural: "clients" };
    default:
      return { singular: "customer", plural: "customers" };
  }
}

/** The tenant's configured client-noun, or the vertical default. */
export function resolveClientNoun(business: Business): ClientNoun {
  return business.config.clientNoun ?? defaultClientNoun(business.vertical);
}

/** Health verticals get the "I can't give medical advice" safety disclaimer. */
export function isMedicalVertical(vertical: Vertical): boolean {
  return vertical === "veterinary" || vertical === "dental";
}
