import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/app/components/SiteNav";
import { loadContext } from "@/lib/context";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await loadContext(slug).catch(() => null);
  if (!ctx) return {};
  const { business } = ctx;
  return {
    title: `About — ${business.name}`,
    description: `Learn about ${business.name} and our ${business.config.assistantName ?? "AI"} booking assistant.`,
  };
}

export default async function ClinicAboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await loadContext(slug).catch(() => null);
  if (!ctx) notFound();
  const { business } = ctx;
  const c = business.config;
  const assistantName = c.assistantName ?? "Sofia";

  const steps = [
    { n: "1", title: "Ask anything", body: `Clients ask about hours, location, facilities, services or pricing — by chat or voice, in their own language.` },
    { n: "2", title: "Book in seconds", body: `${assistantName} offers real open times and books, reschedules, or cancels — never double-booking a team member.` },
    { n: "3", title: "Feel cared for", body: `A soft-spoken voice greets returning clients by name and remembers their last visit.` },
  ];

  const features = [
    { title: "Full brand concierge", body: `Answers everything about ${business.name} from a managed knowledge base — not a fixed FAQ list.` },
    { title: "Conflict-free booking", body: "A database guarantee means two appointments can never overlap, even under load." },
    { title: "Warm, human voice", body: "Production voice via ElevenLabs, with a built-in browser fallback so it works anywhere." },
    { title: "Multilingual", body: "Detects the client's language and replies in it, with safety guidance localized too." },
    ...(c.emergencyLine ? [{ title: "Safety first", body: `Never gives professional advice — always reassures and books the soonest visit or shares the emergency line ${c.emergencyLine}.` }] : []),
  ];

  return (
    <>
      <SiteNav slug={slug} brandName={business.name} emoji={c.branding?.bubbleEmoji} />
      <main className="bg-background">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            About
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground">
            {assistantName} — a warm assistant at {business.name}.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
            {c.tagline ?? `${assistantName} answers your questions and books appointments at ${business.name} — by chat or voice, day or night.`}
          </p>

          <h2 className="mt-12 text-xl font-semibold text-foreground">How it works</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {s.n}
                </div>
                <h3 className="mt-3 font-medium text-card-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-12 text-xl font-semibold text-foreground">What makes it good</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-medium text-card-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href={`/c/${slug}`}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-95"
            >
              Chat with {assistantName}
            </Link>
            <Link
              href={`/c/${slug}/contact`}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted active:scale-95"
            >
              Contact us
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
