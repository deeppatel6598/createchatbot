import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ChatWidget from "@/app/components/ChatWidget";
import { SiteNav } from "@/app/components/SiteNav";
import { loadContext } from "@/lib/context";
import { resolveClientNoun } from "@/lib/vertical";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await loadContext(slug).catch(() => null);
  if (!ctx) return {};
  const { business } = ctx;
  const c = business.config;
  return {
    title: `${business.name} — ${c.assistantName ?? "AI"} Booking Assistant`,
    description: c.tagline ?? `Book an appointment at ${business.name} by chat or voice.`,
  };
}

export default async function ClinicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await loadContext(slug).catch(() => null);
  if (!ctx) notFound();
  const { business } = ctx;
  const c = business.config;
  const noun = resolveClientNoun(business);

  return (
    <>
      <SiteNav slug={slug} brandName={business.name} emoji={c.branding.bubbleEmoji} />
      <main className="bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
          <section className="order-2 lg:order-1">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {c.branding.bubbleEmoji ?? "💬"} AI voice &amp; chat concierge
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Meet {c.assistantName} — your friendly assistant at {business.name}.
            </h1>
            <p className="mt-4 max-w-md text-pretty text-muted-foreground">
              {c.tagline ?? `Ask anything about ${business.name} — hours, location, services, pricing — or book a visit, by chat or voice.`}
            </p>
            <p className="mt-6 max-w-md text-sm text-muted-foreground">
              Tap the mic and just talk, or type a question about your {noun.singular}.
            </p>
          </section>

          <section className="order-1 flex justify-center lg:order-2">
            <ChatWidget slug={slug} />
          </section>
        </div>
      </main>
    </>
  );
}
