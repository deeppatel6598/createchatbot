/**
 * Domain types — framework-agnostic, shared by the in-memory and Prisma
 * repositories, the booking domain, and the AI concierge.
 */

export type Vertical = "veterinary" | "salon" | "dental" | "generic";

export interface VoicePersona {
  /** Human first name the assistant introduces itself with, e.g. "Sofia". */
  displayName: string;
  gender: "female" | "male" | "neutral";
  /** Plain-language description of the target delivery. */
  description: string;
  /** Preferred TTS provider. webspeech is the zero-cost in-browser fallback. */
  provider: "elevenlabs" | "deepgram" | "openai" | "webspeech";
  elevenLabsVoiceId?: string;
  /** Speaking rate; < 1 is slower / gentler. */
  rate: number;
  pitch: number;
  /** Hints used to pick a warm voice from the browser's Web Speech voices. */
  preferVoiceNames?: string[];
}

export interface BrandConfig {
  timezone: string;
  assistantName: string;
  tagline?: string;
  branding: { primary: string; accent: string; bubbleEmoji?: string };
  voice: VoicePersona;
  /** Tone words that shape both chat wording and spoken delivery. */
  tone: string[];
  hoursText?: string;
  policies?: string[];
  emergencyLine?: string;
  /**
   * What the business serves, used to localize wording (e.g. veterinary → pet,
   * dental → patient, salon → client). When unset, a vertical default applies.
   */
  clientNoun?: { singular: string; plural: string };
  /**
   * Per-clinic staff password (scrypt hash). Set by the operator at onboarding.
   * NEVER serialized to the public /api/business meta.
   */
  staffAuth?: { hash: string; algo: "scrypt" };
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  vertical: Vertical;
  config: BrandConfig;
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  durationMin: number;
  priceCents?: number | null;
  description?: string | null;
}

export interface Resource {
  id: string;
  businessId: string;
  name: string;
  role?: string | null;
  /** Google Calendar id this resource's bookings sync to (else the default). */
  googleCalId?: string | null;
}

/** A busy time range, e.g. from an external calendar's free/busy query. */
export interface BusyInterval {
  startISO: string;
  endISO: string;
}

export interface AvailabilityRule {
  id: string;
  resourceId: string;
  weekday: number; // 0 = Sunday .. 6 = Saturday
  startMin: number; // minutes from midnight (clinic-local)
  endMin: number;
}

export interface Pet {
  name: string;
  species?: string;
  breed?: string;
  age?: string;
}

export interface Client {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email?: string | null;
  attributes?: { pets?: Pet[] } & Record<string, unknown>;
}

export type ApptStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export interface Appointment {
  id: string;
  businessId: string;
  clientId: string;
  resourceId: string;
  serviceId: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: ApptStatus;
  /** Synced Google Calendar event id, when calendar sync is enabled. */
  googleEventId?: string | null;
  notes?: string | null;
  attributes?: Record<string, unknown> | null;
}

export type KnowledgeKind =
  | "FAQ"
  | "SERVICE"
  | "FACILITY"
  | "LOCATION"
  | "POLICY"
  | "TEAM"
  | "HOURS"
  | "PRICING"
  | "GENERAL";

export interface KnowledgeEntry {
  id: string;
  businessId: string;
  kind: KnowledgeKind;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * The full graph an operator submits to provision a new clinic in one atomic
 * step: the business plus its services, team (resources) with weekly hours, and
 * knowledge/FAQ entries. Built by the provisioning domain (lib/domain/provisioning.ts).
 */
export interface BusinessGraphInput {
  slug: string;
  name: string;
  vertical: Vertical;
  config: BrandConfig;
  services: Array<{
    name: string;
    durationMin: number;
    priceCents?: number | null;
    description?: string | null;
  }>;
  resources: Array<{
    name: string;
    role?: string | null;
    googleCalId?: string | null;
    availability: Array<{ weekday: number; startMin: number; endMin: number }>;
  }>;
  knowledge: Array<{
    kind: KnowledgeKind;
    title: string;
    body: string;
    metadata?: Record<string, unknown> | null;
  }>;
}

export interface BusinessSummary {
  id: string;
  slug: string;
  name: string;
  vertical: Vertical;
}

export type Channel = "chat" | "voice";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * The port (hexagonal architecture). Domain logic and the AI tools depend only
 * on this interface — never on Prisma directly — so a query bug can't forget the
 * tenant scope and the same code runs against memory or Postgres.
 */
export interface Repo {
  getBusinessBySlug(slug: string): Promise<Business | null>;
  /** Resolve a tenant by id (used by the businessId-scoped admin session). */
  getBusinessById(id: string): Promise<Business | null>;
  /** All tenants — operator console list. */
  listBusinesses(): Promise<Business[]>;
  /** Create a tenant and all its children atomically (operator onboarding). */
  createBusinessGraph(input: BusinessGraphInput): Promise<Business>;
  /** Update a tenant's identity/config (operator edit). */
  updateBusiness(
    id: string,
    patch: Partial<Pick<Business, "name" | "vertical" | "config">>,
  ): Promise<Business>;
  /** Remove a tenant and all its children (cascade). */
  deleteBusiness(id: string): Promise<void>;
  listServices(businessId: string): Promise<Service[]>;
  listResources(businessId: string): Promise<Resource[]>;
  listAvailabilityRules(resourceId: string): Promise<AvailabilityRule[]>;
  searchKnowledge(
    businessId: string,
    query: string,
    kind?: KnowledgeKind,
  ): Promise<KnowledgeEntry[]>;
  findClientByPhone(businessId: string, phone: string): Promise<Client | null>;
  getClientById(businessId: string, id: string): Promise<Client | null>;
  upsertClient(input: {
    businessId: string;
    name: string;
    phone: string;
    email?: string;
    pet?: Pet;
  }): Promise<Client>;
  listAppointmentsForResource(
    resourceId: string,
    fromISO: string,
    toISO: string,
  ): Promise<Appointment[]>;
  /** All appointments for a tenant (admin views). */
  listAppointments(
    businessId: string,
    opts?: { fromISO?: string; includeCancelled?: boolean },
  ): Promise<Appointment[]>;
  listClients(businessId: string): Promise<Client[]>;
  /** Throws ConflictError if the slot overlaps an existing active appointment. */
  createAppointment(input: {
    businessId: string;
    clientId: string;
    resourceId: string;
    serviceId: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
    attributes?: Record<string, unknown>;
  }): Promise<Appointment>;
  getAppointmentsByPhone(
    businessId: string,
    phone: string,
  ): Promise<Appointment[]>;
  updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "startsAt" | "endsAt" | "status" | "googleEventId">>,
  ): Promise<Appointment>;
}

export class ConflictError extends Error {
  constructor(message = "That time was just taken.") {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}
