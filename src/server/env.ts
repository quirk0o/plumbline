import { z } from 'zod'

// Required in every environment: the database and S3-compatible object storage
// (MinIO in dev, R2 in prod). Image uploads work in all environments, so the
// S3 credentials are never optional.
const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  // Optional even in production: Auth.js infers the canonical URL from the
  // request host when AUTH_URL is unset, so it is not a required prod secret
  // the way AUTH_SECRET / the OAuth credentials are.
  AUTH_URL: z.url().optional(),
})

// Development and test are lenient: auth/email/OAuth secrets are absent from
// local setups and from .env.test, and AUTH_TEST_MODE may be enabled.
const developmentEnvSchema = sharedEnvSchema.extend({
  NODE_ENV: z.literal('development'),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  // Parsed to a real boolean (defaults to false when unset) so downstream
  // truthiness checks can't be fooled by a stray string like "false".
  AUTH_TEST_MODE: z.stringbool().optional().default(false),
})

// Test is identical to development except for the discriminator.
const testEnvSchema = developmentEnvSchema.extend({
  NODE_ENV: z.literal('test'),
})

// Production is strict: every auth/email/OAuth secret is required, and the
// passwordless E2E login flag must never be enabled.
const productionEnvSchema = sharedEnvSchema.extend({
  NODE_ENV: z.literal('production'),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  // Reject ANY truthy form ("true", "1", "yes", "on", …), not just "true".
  AUTH_TEST_MODE: z
    .stringbool()
    .optional()
    .default(false)
    .refine((enabled) => enabled === false, {
      message: 'AUTH_TEST_MODE must never be enabled in production',
    }),
})

const envSchema = z.discriminatedUnion('NODE_ENV', [
  developmentEnvSchema,
  testEnvSchema,
  productionEnvSchema,
])

export type Env = z.infer<typeof envSchema>

/**
 * Validates a raw environment record against the schema, throwing a readable
 * aggregate error if anything is missing or malformed. Exported separately
 * from `env` so it can be unit-tested with crafted inputs.
 *
 * NODE_ENV is normalized to 'development' when absent before discrimination —
 * a discriminated union needs the discriminator present to pick a member.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse({
    ...source,
    NODE_ENV: source.NODE_ENV ?? 'development',
  })
  if (result.success) return result.data

  const details = result.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment variables:\n${details}`)
}

// Parsed once at module load. Importing this module anywhere in the server
// boot path turns a misconfiguration into an immediate startup crash instead
// of a cryptic runtime error later.
export const env = parseEnv(process.env)
