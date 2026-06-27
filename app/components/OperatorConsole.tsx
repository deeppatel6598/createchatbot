"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultClientNoun } from "@/lib/vertical";
import type { Vertical } from "@/lib/types";

type Clinic = { id: string; slug: string; name: string; vertical: string };
type View = "loading" | "login" | "list" | "new";

const VERTICALS: Vertical[] = ["veterinary", "dental", "salon", "generic"];
const DAYS: { label: string; weekday: number }[] = [
  { label: "Mon", weekday: 1 },
  { label: "Tue", weekday: 2 },
  { label: "Wed", weekday: 3 },
  { label: "Thu", weekday: 4 },
  { label: "Fri", weekday: 5 },
  { label: "Sat", weekday: 6 },
  { label: "Sun", weekday: 0 },
];

const field =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary";
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

type ServiceRow = { name: string; durationMin: string; price: string; description: string };
type ResourceRow = { name: string; role: string; days: number[]; start: string; end: string };
type KnowledgeRow = { kind: string; title: string; body: string };

const KINDS = ["FAQ", "SERVICE", "FACILITY", "LOCATION", "POLICY", "TEAM", "HOURS", "PRICING", "GENERAL"];

export function OperatorConsole() {
  const [view, setView] = useState<View>("loading");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/operator/businesses", { cache: "no-store" });
    if (res.status === 401) {
      setView("login");
      return;
    }
    const json = await res.json();
    setClinics(json.data ?? []);
    setView("list");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/operator/businesses", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 401) {
          setView("login");
          return;
        }
        const json = await res.json();
        setClinics(json.data ?? []);
        setView("list");
      })
      .catch(() => {
        if (active) setView("login");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/operator/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setPassword("");
      setView("loading");
      await load();
    } else {
      setError("Incorrect password.");
    }
  };

  const logout = async () => {
    await fetch("/api/operator/logout", { method: "POST" });
    setClinics([]);
    setView("login");
  };

  if (view === "loading") {
    return <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">Loading…</main>;
  }

  if (view === "login") {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-card-foreground">Operator sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage every clinic on the platform.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Operator password" aria-label="Operator password" className={`mt-4 ${field}`} />
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
          <button type="submit" className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground transition active:scale-[0.98]">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Clinics</h1>
          <p className="text-xs text-muted-foreground">Operator console · {clinics.length} clinic{clinics.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex gap-2">
          {view === "list" ? (
            <button onClick={() => setView("new")} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition active:scale-95">
              + New clinic
            </button>
          ) : (
            <button onClick={() => setView("list")} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition active:scale-95 hover:bg-muted">
              Back to list
            </button>
          )}
          <button onClick={logout} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition active:scale-95 hover:bg-muted">
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {view === "list" && (
          <>
            {clinics.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No clinics yet. Click “New clinic” to onboard your first one.
              </p>
            )}
            {clinics.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div>
                  <p className="font-medium text-card-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">/{c.slug} · {c.vertical}</p>
                </div>
                <div className="flex gap-2 text-sm">
                  <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10">
                    Open site
                  </a>
                  <a href={`/c/${c.slug}/admin`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted">
                    Dashboard
                  </a>
                </div>
              </div>
            ))}
          </>
        )}

        {view === "new" && <NewClinicForm onCreated={() => void load()} />}
      </div>
    </main>
  );
}

function NewClinicForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [vertical, setVertical] = useState<Vertical>("veterinary");
  const [primary, setPrimary] = useState("#2F6F6A");
  const [accent, setAccent] = useState("#E8B04B");
  const [emoji, setEmoji] = useState("🐾");
  const [tagline, setTagline] = useState("");
  const [assistantName, setAssistantName] = useState("Sofia");
  const [gender, setGender] = useState<"female" | "male" | "neutral">("female");
  const [voiceDesc, setVoiceDesc] = useState("warm, soft-spoken and unhurried");
  const [tone, setTone] = useState("warm, reassuring, gentle");
  const [nounSingular, setNounSingular] = useState("pet");
  const [nounPlural, setNounPlural] = useState("pets");
  const [timezone, setTimezone] = useState("America/New_York");
  const [hoursText, setHoursText] = useState("Mon–Fri 9am–5pm");
  const [policies, setPolicies] = useState("We ask for 24 hours' notice for cancellations.");
  const [emergencyLine, setEmergencyLine] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [autoFaq, setAutoFaq] = useState(true);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [services, setServices] = useState<ServiceRow[]>([{ name: "Wellness Exam", durationMin: "30", price: "65", description: "" }]);
  const [resources, setResources] = useState<ResourceRow[]>([{ name: "", role: "", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }]);
  const [knowledge, setKnowledge] = useState<KnowledgeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Keep the slug + client-noun in step with the name/vertical unless overridden.
  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };
  const setVerticalAndNoun = (v: Vertical) => {
    setVertical(v);
    const n = defaultClientNoun(v);
    setNounSingular(n.singular);
    setNounPlural(n.plural);
  };

  const valid = name.trim() && slug.trim() && staffPassword.length >= 6 && services.some((s) => s.name.trim()) && resources.some((r) => r.name.trim());

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
    const payload = {
      identity: { name: name.trim(), slug: slug.trim(), vertical },
      config: {
        timezone,
        assistantName: assistantName.trim() || "Sofia",
        tagline: tagline.trim() || undefined,
        branding: { primary, accent, bubbleEmoji: emoji || undefined },
        voice: { displayName: assistantName.trim() || "Sofia", gender, description: voiceDesc, provider: "webspeech", rate: 1, pitch: 1 },
        tone: tone.split(",").map((s) => s.trim()).filter(Boolean),
        hoursText: hoursText.trim() || undefined,
        policies: policies.split("\n").map((s) => s.trim()).filter(Boolean),
        emergencyLine: emergencyLine.trim() || undefined,
        clientNoun: { singular: nounSingular.trim(), plural: nounPlural.trim() },
      },
      staffPassword,
      contact: { address: address.trim() || undefined, phone: phone.trim() || undefined },
      services: services
        .filter((s) => s.name.trim())
        .map((s) => ({
          name: s.name.trim(),
          durationMin: Number(s.durationMin) || 30,
          priceCents: s.price ? Math.round(Number(s.price) * 100) : null,
          description: s.description.trim() || null,
        })),
      resources: resources
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          role: r.role.trim() || null,
          availability: r.days.map((weekday) => ({ weekday, startMin: toMin(r.start), endMin: toMin(r.end) })),
        })),
      knowledge: knowledge.filter((k) => k.title.trim() && k.body.trim()).map((k) => ({ kind: k.kind, title: k.title.trim(), body: k.body.trim() })),
      autoFaq,
    };

    const res = await fetch("/api/operator/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      onCreated();
    } else {
      const j = await res.json().catch(() => null);
      setError(j?.error?.message ?? "Could not create the clinic.");
    }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Section title="Identity">
        <Row>
          <Labeled label="Clinic name"><input className={field} value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Paws & Care Veterinary Clinic" /></Labeled>
          <Labeled label="URL slug"><input className={field} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="paws-and-care" /></Labeled>
        </Row>
        <Row>
          <Labeled label="Business type">
            <select className={field} value={vertical} onChange={(e) => setVerticalAndNoun(e.target.value as Vertical)}>
              {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Labeled>
          <Labeled label="Tagline (optional)"><input className={field} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Compassionate care for your family." /></Labeled>
        </Row>
        <Row>
          <Labeled label="Address (optional)"><input className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="248 Maple St, Springfield" /></Labeled>
          <Labeled label="Phone (optional)"><input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 248-7297" /></Labeled>
        </Row>
      </Section>

      <Section title="Branding & assistant">
        <Row>
          <Labeled label="Primary color"><input type="color" className="h-10 w-full rounded-xl border border-input bg-background" value={primary} onChange={(e) => setPrimary(e.target.value)} /></Labeled>
          <Labeled label="Accent color"><input type="color" className="h-10 w-full rounded-xl border border-input bg-background" value={accent} onChange={(e) => setAccent(e.target.value)} /></Labeled>
          <Labeled label="Emoji"><input className={field} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} /></Labeled>
        </Row>
        <Row>
          <Labeled label="Assistant name"><input className={field} value={assistantName} onChange={(e) => setAssistantName(e.target.value)} /></Labeled>
          <Labeled label="Voice gender">
            <select className={field} value={gender} onChange={(e) => setGender(e.target.value as "female" | "male" | "neutral")}>
              <option value="female">female</option>
              <option value="male">male</option>
              <option value="neutral">neutral</option>
            </select>
          </Labeled>
        </Row>
        <Labeled label="Voice description"><input className={field} value={voiceDesc} onChange={(e) => setVoiceDesc(e.target.value)} /></Labeled>
        <Row>
          <Labeled label="Tone words (comma-separated)"><input className={field} value={tone} onChange={(e) => setTone(e.target.value)} /></Labeled>
        </Row>
        <Row>
          <Labeled label="Client noun (singular)"><input className={field} value={nounSingular} onChange={(e) => setNounSingular(e.target.value)} placeholder="patient" /></Labeled>
          <Labeled label="Client noun (plural)"><input className={field} value={nounPlural} onChange={(e) => setNounPlural(e.target.value)} placeholder="patients" /></Labeled>
        </Row>
      </Section>

      <Section title="Hours & policies">
        <Row>
          <Labeled label="Timezone"><input className={field} value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Labeled>
          <Labeled label="Hours (display text)"><input className={field} value={hoursText} onChange={(e) => setHoursText(e.target.value)} /></Labeled>
        </Row>
        <Labeled label="Policies (one per line)"><textarea className={`${field} h-auto py-2`} rows={2} value={policies} onChange={(e) => setPolicies(e.target.value)} /></Labeled>
        <Labeled label="Emergency line (optional)"><input className={field} value={emergencyLine} onChange={(e) => setEmergencyLine(e.target.value)} /></Labeled>
      </Section>

      <Section title="Services">
        {services.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_1fr_28px] items-center gap-2">
            <input className={field} placeholder="Service name" value={s.name} onChange={(e) => setServices(upd(services, i, { name: e.target.value }))} />
            <input className={field} placeholder="min" inputMode="numeric" value={s.durationMin} onChange={(e) => setServices(upd(services, i, { durationMin: e.target.value }))} />
            <input className={field} placeholder="$" inputMode="numeric" value={s.price} onChange={(e) => setServices(upd(services, i, { price: e.target.value }))} />
            <input className={field} placeholder="description" value={s.description} onChange={(e) => setServices(upd(services, i, { description: e.target.value }))} />
            <button onClick={() => setServices(services.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger" aria-label="Remove">×</button>
          </div>
        ))}
        <AddButton onClick={() => setServices([...services, { name: "", durationMin: "30", price: "", description: "" }])} label="Add service" />
      </Section>

      <Section title="Team & weekly hours">
        {resources.map((r, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-3">
            <div className="grid grid-cols-[1fr_1fr_28px] items-center gap-2">
              <input className={field} placeholder="Name (e.g. Dr. Reyes)" value={r.name} onChange={(e) => setResources(upd(resources, i, { name: e.target.value }))} />
              <input className={field} placeholder="Role (optional)" value={r.role} onChange={(e) => setResources(upd(resources, i, { role: e.target.value }))} />
              <button onClick={() => setResources(resources.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger" aria-label="Remove">×</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DAYS.map((d) => {
                const on = r.days.includes(d.weekday);
                return (
                  <button
                    key={d.weekday}
                    onClick={() => setResources(upd(resources, i, { days: on ? r.days.filter((x) => x !== d.weekday) : [...r.days, d.weekday] }))}
                    className={`rounded-lg border px-2 py-1 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {d.label}
                  </button>
                );
              })}
              <input type="time" className="h-9 rounded-lg border border-input bg-background px-2 text-xs" value={r.start} onChange={(e) => setResources(upd(resources, i, { start: e.target.value }))} />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="time" className="h-9 rounded-lg border border-input bg-background px-2 text-xs" value={r.end} onChange={(e) => setResources(upd(resources, i, { end: e.target.value }))} />
            </div>
          </div>
        ))}
        <AddButton onClick={() => setResources([...resources, { name: "", role: "", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }])} label="Add team member" />
      </Section>

      <Section title="Knowledge / FAQ">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={autoFaq} onChange={(e) => setAutoFaq(e.target.checked)} />
          Auto-generate starter FAQ from the details above (recommended)
        </label>
        {knowledge.map((k, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-3">
            <div className="grid grid-cols-[140px_1fr_28px] items-center gap-2">
              <select className={field} value={k.kind} onChange={(e) => setKnowledge(upd(knowledge, i, { kind: e.target.value }))}>
                {KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
              <input className={field} placeholder="Question / title" value={k.title} onChange={(e) => setKnowledge(upd(knowledge, i, { title: e.target.value }))} />
              <button onClick={() => setKnowledge(knowledge.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger" aria-label="Remove">×</button>
            </div>
            <textarea className={`${field} h-auto py-2`} rows={2} placeholder="Answer" value={k.body} onChange={(e) => setKnowledge(upd(knowledge, i, { body: e.target.value }))} />
          </div>
        ))}
        <AddButton onClick={() => setKnowledge([...knowledge, { kind: "FAQ", title: "", body: "" }])} label="Add FAQ entry" />
      </Section>

      <Section title="Staff access">
        <Labeled label="Staff dashboard password (min 6 chars)">
          <input type="password" className={field} value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="Set a password for this clinic's staff" />
        </Labeled>
      </Section>

      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        disabled={!valid || busy}
        onClick={submit}
        className="h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground transition active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "Creating clinic…" : "Create clinic"}
      </button>
    </div>
  );
}

function upd<T>(rows: T[], i: number, patch: Partial<T>): T[] {
  return rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      {children}
    </section>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2">{children}</div>;
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-primary">
      + {label}
    </button>
  );
}
