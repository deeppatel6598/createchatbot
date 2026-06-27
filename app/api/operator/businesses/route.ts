import { NextRequest, NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { isOperator } from "@/lib/operator-auth";
import { provisionBusiness, type ProvisionBusinessInput } from "@/lib/domain/provisioning";
import { provisionSchema } from "@/lib/operator-input";
import { ConflictError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/operator/businesses — list every clinic (operator only). */
export async function GET(req: NextRequest) {
  if (!isOperator(req)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  const businesses = await getRepo().listBusinesses();
  return NextResponse.json({
    data: businesses.map((b) => ({ id: b.id, slug: b.slug, name: b.name, vertical: b.vertical })),
  });
}

/** POST /api/operator/businesses — provision a new clinic (operator only). */
export async function POST(req: NextRequest) {
  if (!isOperator(req)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = provisionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Please check the form", details: parsed.error.issues } },
      { status: 422 },
    );
  }
  try {
    const business = await provisionBusiness(getRepo(), parsed.data as ProvisionBusinessInput);
    return NextResponse.json({ data: { id: business.id, slug: business.slug, name: business.name } }, { status: 201 });
  } catch (err) {
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: { code: "slug_taken", message: err.message } }, { status: 409 });
    }
    console.error("provision error", err);
    return NextResponse.json({ error: { code: "internal_error", message: "Could not create the clinic." } }, { status: 500 });
  }
}
