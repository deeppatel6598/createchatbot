import { NextRequest, NextResponse } from "next/server";
import { loadContext, slugFromRequest } from "@/lib/context";
import { elevenLabsConfigured } from "@/lib/voice/elevenlabs-server";
import { resolveClientNoun } from "@/lib/vertical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/business — public meta the widget needs to render + speak. */
export async function GET(req: NextRequest) {
  const ctx = await loadContext(slugFromRequest(req)).catch(() => null);
  if (!ctx) return NextResponse.json({ error: { code: "not_found", message: "Unknown clinic" } }, { status: 404 });
  const { repo, business } = ctx;
  const services = await repo.listServices(business.id);
  const c = business.config;
  return NextResponse.json({
    data: {
      name: business.name,
      slug: business.slug,
      assistantName: c.assistantName,
      tagline: c.tagline,
      branding: c.branding,
      clientNoun: resolveClientNoun(business),
      persona: c.voice,
      voiceProvider: elevenLabsConfigured() ? "elevenlabs" : "webspeech",
      hoursText: c.hoursText,
      emergencyLine: c.emergencyLine,
      services: services.map((s) => ({
        name: s.name,
        durationMin: s.durationMin,
        price: s.priceCents != null ? `$${(s.priceCents / 100).toFixed(0)}` : null,
        description: s.description,
      })),
      suggestions: [
        "Where are you located?",
        "What are your hours?",
        "What services do you offer?",
        "I'd like to book a visit",
      ],
    },
  });
}
