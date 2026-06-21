import { getRepo } from "@/lib/repo";
import { NotFoundError, type Business, type Repo } from "@/lib/types";
import type { NextRequest } from "next/server";

/**
 * Tenant resolution. The active business is chosen per request from the `?b=<slug>`
 * query (sent by the `/c/[slug]` pages), falling back to the `BUSINESS_SLUG` env
 * for the legacy single-tenant deployment. The domain is fully tenant-scoped, so
 * this is the only place a request decides which clinic it's operating on.
 */
export const ACTIVE_SLUG = process.env.BUSINESS_SLUG || "paws-and-care";

export async function loadContext(slug?: string): Promise<{ repo: Repo; business: Business }> {
  const repo = getRepo();
  const resolved = slug || ACTIVE_SLUG;
  const business = await repo.getBusinessBySlug(resolved);
  if (!business) throw new NotFoundError(`No business configured for slug "${resolved}"`);
  return { repo, business };
}

/** The clinic slug a request is acting on, from `?b=<slug>` (else env default). */
export function slugFromRequest(req: NextRequest): string | undefined {
  return new URL(req.url).searchParams.get("b") ?? undefined;
}
