import { z } from "zod";

/** Shared validation for the operator onboarding/edit payloads. */

export const VERTICALS = ["veterinary", "salon", "dental", "generic"] as const;
const KNOWLEDGE_KINDS = ["FAQ", "SERVICE", "FACILITY", "LOCATION", "POLICY", "TEAM", "HOURS", "PRICING", "GENERAL"] as const;

const voiceSchema = z.object({
  displayName: z.string().min(1).max(60),
  gender: z.enum(["female", "male", "neutral"]),
  description: z.string().max(300).default(""),
  provider: z.enum(["elevenlabs", "deepgram", "openai", "webspeech"]).default("webspeech"),
  elevenLabsVoiceId: z.string().max(120).optional(),
  rate: z.number().min(0.5).max(1.5).default(1),
  pitch: z.number().min(0.5).max(1.5).default(1),
  preferVoiceNames: z.array(z.string().max(80)).max(20).optional(),
});

export const configSchema = z.object({
  timezone: z.string().min(1).max(60),
  assistantName: z.string().min(1).max(60),
  tagline: z.string().max(200).optional(),
  branding: z.object({
    primary: z.string().min(1).max(32),
    accent: z.string().min(1).max(32),
    bubbleEmoji: z.string().max(8).optional(),
  }),
  voice: voiceSchema,
  tone: z.array(z.string().max(40)).max(12).default([]),
  hoursText: z.string().max(300).optional(),
  policies: z.array(z.string().max(500)).max(20).optional(),
  emergencyLine: z.string().max(60).optional(),
  clientNoun: z.object({ singular: z.string().min(1).max(40), plural: z.string().min(1).max(40) }).optional(),
});

export const provisionSchema = z.object({
  identity: z.object({
    name: z.string().min(1).max(120),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
      .max(60),
    vertical: z.enum(VERTICALS),
  }),
  config: configSchema,
  staffPassword: z.string().min(6).max(200),
  contact: z
    .object({
      address: z.string().max(300).optional(),
      phone: z.string().max(60).optional(),
      email: z.string().max(200).optional(),
      mapUrl: z.string().max(500).optional(),
    })
    .optional(),
  services: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        durationMin: z.number().int().min(5).max(600),
        priceCents: z.number().int().min(0).max(10_000_00).nullable().optional(),
        description: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1),
  resources: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        role: z.string().max(120).nullable().optional(),
        googleCalId: z.string().max(200).nullable().optional(),
        availability: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              startMin: z.number().int().min(0).max(1440),
              endMin: z.number().int().min(0).max(1440),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
  knowledge: z
    .array(
      z.object({
        kind: z.enum(KNOWLEDGE_KINDS),
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(4000),
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    )
    .optional(),
  autoFaq: z.boolean().optional(),
});

export const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  vertical: z.enum(VERTICALS).optional(),
  config: configSchema.optional(),
  staffPassword: z.string().min(6).max(200).optional(),
});
