import {
  Appointment,
  Business,
  BusinessGraphInput,
  Client,
  ConflictError,
  KnowledgeKind,
  Pet,
  Repo,
  Resource,
  Service,
} from "@/lib/types";
import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const iso = (d: Date) => d.toISOString();

/** Repo backed by PostgreSQL via Prisma. Every method is tenant-scoped. */
export class PrismaRepo implements Repo {
  private get db() {
    return getPrisma();
  }

  private toBusiness = (b: {
    id: string;
    slug: string;
    name: string;
    vertical: string;
    config: unknown;
  }): Business => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    vertical: b.vertical as Business["vertical"],
    config: b.config as unknown as Business["config"],
  });

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    const b = await this.db.business.findUnique({ where: { slug } });
    return b ? this.toBusiness(b) : null;
  }

  async getBusinessById(id: string): Promise<Business | null> {
    const b = await this.db.business.findUnique({ where: { id } });
    return b ? this.toBusiness(b) : null;
  }

  async listBusinesses(): Promise<Business[]> {
    const rows = await this.db.business.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(this.toBusiness);
  }

  async createBusinessGraph(input: BusinessGraphInput): Promise<Business> {
    try {
      const created = await this.db.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            slug: input.slug,
            name: input.name,
            vertical: input.vertical,
            config: input.config as unknown as Prisma.InputJsonValue,
          },
        });
        if (input.services.length) {
          await tx.service.createMany({
            data: input.services.map((s) => ({
              businessId: business.id,
              name: s.name,
              durationMin: s.durationMin,
              priceCents: s.priceCents ?? null,
              description: s.description ?? null,
            })),
          });
        }
        for (const r of input.resources) {
          const resource = await tx.resource.create({
            data: { businessId: business.id, name: r.name, role: r.role ?? null, googleCalId: r.googleCalId ?? null },
          });
          if (r.availability.length) {
            await tx.availabilityRule.createMany({
              data: r.availability.map((a) => ({ resourceId: resource.id, weekday: a.weekday, startMin: a.startMin, endMin: a.endMin })),
            });
          }
        }
        if (input.knowledge.length) {
          await tx.knowledgeEntry.createMany({
            data: input.knowledge.map((k) => ({
              businessId: business.id,
              kind: k.kind,
              title: k.title,
              body: k.body,
              metadata: (k.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
            })),
          });
        }
        return business;
      });
      return this.toBusiness(created);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Unique constraint|P2002/.test(msg)) {
        throw new ConflictError(`A clinic with slug "${input.slug}" already exists.`);
      }
      throw e;
    }
  }

  async updateBusiness(
    id: string,
    patch: Partial<Pick<Business, "name" | "vertical" | "config">>,
  ): Promise<Business> {
    const b = await this.db.business.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.vertical !== undefined ? { vertical: patch.vertical } : {}),
        ...(patch.config !== undefined ? { config: patch.config as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    return this.toBusiness(b);
  }

  async deleteBusiness(id: string): Promise<void> {
    await this.db.business.delete({ where: { id } });
  }

  async listServices(businessId: string): Promise<Service[]> {
    return this.db.service.findMany({ where: { businessId } });
  }

  async listResources(businessId: string): Promise<Resource[]> {
    return this.db.resource.findMany({
      where: { businessId },
      select: { id: true, businessId: true, name: true, role: true, googleCalId: true },
    });
  }

  async listAvailabilityRules(resourceId: string) {
    return this.db.availabilityRule.findMany({ where: { resourceId } });
  }

  async searchKnowledge(businessId: string, query: string, kind?: KnowledgeKind) {
    // Dev-grade keyword search. Production: tsvector / pgvector (constraints.sql).
    const rows = await this.db.knowledgeEntry.findMany({
      where: {
        businessId,
        ...(kind ? { kind } : {}),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { body: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 3,
    });
    const result = rows.length
      ? rows
      : await this.db.knowledgeEntry.findMany({
          where: { businessId, ...(kind ? { kind } : {}) },
          take: 3,
        });
    return result.map((r) => ({
      id: r.id,
      businessId: r.businessId,
      kind: r.kind as KnowledgeKind,
      title: r.title,
      body: r.body,
      metadata: (r.metadata as Record<string, unknown>) ?? null,
    }));
  }

  async findClientByPhone(businessId: string, phone: string): Promise<Client | null> {
    const c = await this.db.client.findFirst({ where: { businessId, phone } });
    return c ? (c as unknown as Client) : null;
  }

  async getClientById(businessId: string, id: string): Promise<Client | null> {
    const c = await this.db.client.findFirst({ where: { businessId, id } });
    return c ? (c as unknown as Client) : null;
  }

  async upsertClient(input: {
    businessId: string;
    name: string;
    phone: string;
    email?: string;
    pet?: Pet;
  }): Promise<Client> {
    const existing = await this.db.client.findFirst({
      where: { businessId: input.businessId, phone: input.phone },
    });
    const pets = (((existing?.attributes as { pets?: Pet[] })?.pets) ?? []) as Pet[];
    if (input.pet && !pets.some((p) => p.name.toLowerCase() === input.pet!.name.toLowerCase())) {
      pets.push(input.pet);
    }
    const data = {
      name: input.name,
      email: input.email,
      attributes: { ...(existing?.attributes as object), pets } as unknown as Prisma.InputJsonValue,
    };
    const c = existing
      ? await this.db.client.update({ where: { id: existing.id }, data })
      : await this.db.client.create({
          data: { businessId: input.businessId, phone: input.phone, ...data },
        });
    return c as unknown as Client;
  }

  async listAppointmentsForResource(resourceId: string, fromISO: string, toISO: string) {
    const rows = await this.db.appointment.findMany({
      where: {
        resourceId,
        status: { not: "CANCELLED" },
        startsAt: { lt: new Date(toISO) },
        endsAt: { gt: new Date(fromISO) },
      },
    });
    return rows.map(this.toAppt);
  }

  async createAppointment(input: {
    businessId: string;
    clientId: string;
    resourceId: string;
    serviceId: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
    attributes?: Record<string, unknown>;
  }): Promise<Appointment> {
    try {
      const created = await this.db.$transaction(async (tx) => {
        const clash = await tx.appointment.findFirst({
          where: {
            resourceId: input.resourceId,
            status: { not: "CANCELLED" },
            startsAt: { lt: new Date(input.endsAt) },
            endsAt: { gt: new Date(input.startsAt) },
          },
        });
        if (clash) throw new ConflictError();
        return tx.appointment.create({
          data: {
            businessId: input.businessId,
            clientId: input.clientId,
            resourceId: input.resourceId,
            serviceId: input.serviceId,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            status: "CONFIRMED",
            notes: input.notes,
            attributes: (input.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
      });
      return this.toAppt(created);
    } catch (e) {
      // The DB exclusion constraint (constraints.sql) is the race-proof backstop.
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof ConflictError || /appointment_no_overlap|exclusion|23P01/.test(msg)) {
        throw new ConflictError();
      }
      throw e;
    }
  }

  async listAppointments(
    businessId: string,
    opts?: { fromISO?: string; includeCancelled?: boolean },
  ) {
    const rows = await this.db.appointment.findMany({
      where: {
        businessId,
        ...(opts?.includeCancelled ? {} : { status: { not: "CANCELLED" } }),
        ...(opts?.fromISO ? { startsAt: { gte: new Date(opts.fromISO) } } : {}),
      },
      orderBy: { startsAt: "asc" },
    });
    return rows.map(this.toAppt);
  }

  async listClients(businessId: string): Promise<Client[]> {
    const rows = await this.db.client.findMany({ where: { businessId } });
    return rows.map((c) => c as unknown as Client);
  }

  async getAppointmentsByPhone(businessId: string, phone: string) {
    const client = await this.db.client.findFirst({ where: { businessId, phone } });
    if (!client) return [];
    const rows = await this.db.appointment.findMany({
      where: { businessId, clientId: client.id },
      orderBy: { startsAt: "asc" },
    });
    return rows.map(this.toAppt);
  }

  async updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "startsAt" | "endsAt" | "status" | "googleEventId">>,
  ): Promise<Appointment> {
    const row = await this.db.appointment.update({
      where: { id },
      data: {
        ...(patch.startsAt ? { startsAt: new Date(patch.startsAt) } : {}),
        ...(patch.endsAt ? { endsAt: new Date(patch.endsAt) } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.googleEventId !== undefined ? { googleEventId: patch.googleEventId } : {}),
      },
    });
    return this.toAppt(row);
  }

  private toAppt = (r: {
    id: string;
    businessId: string;
    clientId: string;
    resourceId: string;
    serviceId: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    googleEventId?: string | null;
    notes: string | null;
    attributes: unknown;
  }): Appointment => ({
    id: r.id,
    businessId: r.businessId,
    clientId: r.clientId,
    resourceId: r.resourceId,
    serviceId: r.serviceId,
    startsAt: iso(r.startsAt),
    endsAt: iso(r.endsAt),
    status: r.status as Appointment["status"],
    googleEventId: r.googleEventId ?? null,
    notes: r.notes,
    attributes: (r.attributes as Record<string, unknown>) ?? null,
  });
}
