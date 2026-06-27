import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteNav } from "@/app/components/SiteNav";
import { ContactForm } from "@/app/components/ContactForm";
import { loadContext } from "@/lib/context";
import { resolveClientNoun } from "@/lib/vertical";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await loadContext(slug).catch(() => null);
  if (!ctx) return {};
  return {
    title: `Contact — ${ctx.business.name}`,
    description: `Get in touch with ${ctx.business.name}.`,
  };
}

export default async function ClinicContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await loadContext(slug).catch(() => null);
  if (!ctx) notFound();
  const { business } = ctx;
  const c = business.config;
  const noun = resolveClientNoun(business);

  // Pull contact info from the LOCATION knowledge entry if available.
  const knowledge = await ctx.repo.searchKnowledge(business.id, "", "LOCATION");
  const location = knowledge[0];
  const locationMeta = location?.metadata as { phone?: string; mapUrl?: string } | undefined;

  const details: { label: string; value: string; href?: string }[] = [];
  if (c.hoursText) details.push({ label: "Hours", value: c.hoursText });
  if (locationMeta?.phone) details.push({ label: "Phone", value: locationMeta.phone, href: `tel:${locationMeta.phone.replace(/\D/g, "")}` });
  if (c.emergencyLine) details.push({ label: "Emergency", value: c.emergencyLine, href: `tel:${c.emergencyLine.replace(/\D/g, "")}` });

  return (
    <>
      <SiteNav slug={slug} brandName={business.name} emoji={c.branding?.bubbleEmoji} />
      <main className="bg-background">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Contact
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground">
            We&apos;d love to hear from you.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
            Questions about your {noun.singular} or your visit? Send us a note — or just ask{" "}
            {c.assistantName ?? "our assistant"} on the home page and book right away.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {details.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground">Reach us</h2>
                <dl className="mt-4 space-y-4">
                  {details.map((d) => (
                    <div key={d.label} className="rounded-2xl border border-border bg-card p-4">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                      <dd className="mt-1 text-sm text-card-foreground">
                        {d.href ? (
                          <a href={d.href} className="hover:text-primary hover:underline">{d.value}</a>
                        ) : d.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className={details.length === 0 ? "md:col-span-2" : ""}>
              <h2 className="mb-4 text-lg font-semibold text-foreground">Send a message</h2>
              <ContactForm clientNoun={noun.singular} slug={slug} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
