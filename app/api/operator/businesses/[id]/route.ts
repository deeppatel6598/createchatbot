import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { isOperator } from "@/lib/operator-auth";
import { updateSchema } from "@/lib/operator-input";
import { hashStaffPassword } from "@/lib/secret";
import type { BrandConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/operator/businesses/:id — full config for the edit form (operator only). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isOperator(req)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  const { id } = await params;
  const repo = getRepo();
  const business = await repo.getBusinessById(id);
  if (!business) return NextResponse.json({ error: { code: "not_found", message: "Clinic not found" } }, { status: 404 });
  const [services, resources] = await Promise.all([repo.listServices(id), repo.listResources(id)]);
  // Never expose the staff password hash.
  const { staffAuth: _omit, ...config } = business.config;
  void _omit;
  return NextResponse.json({
    data: { id: business.id, slug: business.slug, name: business.name, vertical: business.vertical, config, services, resources },
  });
}

/** PATCH /api/operator/businesses/:id — update identity/config (operator only). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isOperator(req)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  const { id } = await params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error", message: "Please check the form", details: parsed.error.issues } }, { status: 422 });
  }

  const repo = getRepo();
  const existing = await repo.getBusinessById(id);
  if (!existing) return NextResponse.json({ error: { code: "not_found", message: "Clinic not found" } }, { status: 404 });

  const { name, vertical, config, staffPassword } = parsed.data;
  const patch: { name?: string; vertical?: typeof existing.vertical; config?: BrandConfig } = {};
  if (name !== undefined) patch.name = name;
  if (vertical !== undefined) patch.vertical = vertical;
  if (config !== undefined) {
    // Preserve the existing staff hash unless a new password is supplied.
    patch.config = {
      ...(config as BrandConfig),
      staffAuth: staffPassword ? hashStaffPassword(staffPassword) : existing.config.staffAuth,
    };
  } else if (staffPassword) {
    patch.config = { ...existing.config, staffAuth: hashStaffPassword(staffPassword) };
  }

  const updated = await repo.updateBusiness(id, patch);
  return NextResponse.json({ data: { id: updated.id, slug: updated.slug, name: updated.name } });
}

/** DELETE /api/operator/businesses/:id — remove a clinic and its data (operator only). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isOperator(req)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  const { id } = await params;
  await getRepo().deleteBusiness(id);
  return NextResponse.json({ data: { id, deleted: true } });
}
