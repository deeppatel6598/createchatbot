import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../components/SiteNav";
import { ContactForm } from "../components/ContactForm";

export const metadata: Metadata = {
  title: "Contact — Sofia Concierge",
  description: "Get in touch about the Sofia AI booking concierge platform.",
};

export default function ContactPage() {
  return (
    <>
      <SiteNav />
      <main className="bg-background">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Contact
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground">
            Questions? We&apos;d love to hear from you.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
            Interested in adding Sofia to your clinic or business? Looking for the
            demo? Try the chat on the{" "}
            <Link href="/" className="text-primary hover:underline">home page</Link>, or send us a note below.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Platform</h2>
              <dl className="mt-4 space-y-4">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo clinic</dt>
                  <dd className="mt-1 text-sm text-card-foreground">
                    <Link href="/c/paws-and-care" className="text-primary hover:underline">Paws &amp; Care Veterinary</Link>
                    {" "}— book an appointment by chat or voice.
                  </dd>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operator console</dt>
                  <dd className="mt-1 text-sm text-card-foreground">
                    <Link href="/operator" className="text-primary hover:underline">Add your clinic</Link>
                    {" "}— onboard in minutes, no code needed.
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h2 className="mb-4 text-lg font-semibold text-foreground">Send a message</h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
