import { describe, it, expect } from 'vitest'
import { parseEnv } from './env'

// A complete, valid production environment. Tests clone and mutate this to
// exercise one rule at a time.
function validProdEnv(): Record<string, string | undefined> {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
    S3_REGION: 'auto',
    S3_ACCESS_KEY_ID: 'access-key',
    S3_SECRET_ACCESS_KEY: 'secret-key',
    S3_BUCKET: 'simtrack-prod',
    AUTH_SECRET: 'a-very-long-secret',
    AUTH_GOOGLE_ID: 'google-client-id',
    AUTH_GOOGLE_SECRET: 'google-client-secret',
    RESEND_API_KEY: 're_123',
    EMAIL_FROM: 'noreply@example.com',
  }
}

describe('parseEnv', () => {
  it('accepts a complete production environment', () => {
    const env = parseEnv(validProdEnv())
    expect(env.NODE_ENV).toBe('production')
    expect(env.S3_BUCKET).toBe('simtrack-prod')
    expect(env.AUTH_SECRET).toBe('a-very-long-secret')
  })

  it('defaults NODE_ENV to development when absent', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://localhost/db',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'minioadmin',
      S3_SECRET_ACCESS_KEY: 'minioadmin',
      S3_BUCKET: 'simtrack-dev',
    })
    expect(env.NODE_ENV).toBe('development')
  })

  it('does NOT require auth/email/oauth secrets outside production', () => {
    // Mirrors .env.test: only DATABASE_URL + S3_* are set.
    expect(() =>
      parseEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/test',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'minioadmin',
        S3_SECRET_ACCESS_KEY: 'minioadmin',
        S3_BUCKET: 'simtrack-test',
      }),
    ).not.toThrow()
  })

  it('treats present-but-empty optional secrets as absent in development', () => {
    // A local .env commonly has unconfigured placeholders like `RESEND_API_KEY=`.
    // These empty strings must be treated as "not set", not as a non-empty
    // string that fails validation.
    expect(() =>
      parseEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost/db',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'minioadmin',
        S3_SECRET_ACCESS_KEY: 'minioadmin',
        S3_BUCKET: 'simtrack-dev',
        AUTH_GOOGLE_ID: '',
        AUTH_GOOGLE_SECRET: '',
        RESEND_API_KEY: '',
        EMAIL_FROM: '',
        AUTH_SECRET: '',
      }),
    ).not.toThrow()
  })

  it('rejects a present-but-empty required variable (empty = absent)', () => {
    const env = validProdEnv()
    env.S3_BUCKET = ''
    expect(() => parseEnv(env)).toThrow(/S3_BUCKET/)
  })

  it('requires S3 credentials in every environment', () => {
    const env = validProdEnv()
    env.NODE_ENV = 'development'
    delete env.S3_BUCKET
    expect(() => parseEnv(env)).toThrow(/S3_BUCKET/)
  })

  it('rejects a missing DATABASE_URL', () => {
    const env = validProdEnv()
    delete env.DATABASE_URL
    expect(() => parseEnv(env)).toThrow(/DATABASE_URL/)
  })

  it('rejects an S3_ENDPOINT that is not a URL', () => {
    const env = validProdEnv()
    env.S3_ENDPOINT = 'not-a-url'
    expect(() => parseEnv(env)).toThrow(/S3_ENDPOINT/)
  })

  it('requires AUTH_SECRET in production', () => {
    const env = validProdEnv()
    delete env.AUTH_SECRET
    expect(() => parseEnv(env)).toThrow(/AUTH_SECRET/)
  })

  it('requires RESEND_API_KEY and EMAIL_FROM in production', () => {
    const noResend = validProdEnv()
    delete noResend.RESEND_API_KEY
    expect(() => parseEnv(noResend)).toThrow(/RESEND_API_KEY/)

    const noFrom = validProdEnv()
    delete noFrom.EMAIL_FROM
    expect(() => parseEnv(noFrom)).toThrow(/EMAIL_FROM/)
  })

  it('requires Google OAuth credentials in production', () => {
    const noId = validProdEnv()
    delete noId.AUTH_GOOGLE_ID
    expect(() => parseEnv(noId)).toThrow(/AUTH_GOOGLE_ID/)

    const noSecret = validProdEnv()
    delete noSecret.AUTH_GOOGLE_SECRET
    expect(() => parseEnv(noSecret)).toThrow(/AUTH_GOOGLE_SECRET/)
  })

  it('hard-fails when AUTH_TEST_MODE is enabled in production', () => {
    const env = validProdEnv()
    env.AUTH_TEST_MODE = 'true'
    expect(() => parseEnv(env)).toThrow(/AUTH_TEST_MODE/)
  })

  it('rejects ANY truthy AUTH_TEST_MODE form in production, not just "true"', () => {
    for (const truthy of ['1', 'yes', 'on']) {
      const env = validProdEnv()
      env.AUTH_TEST_MODE = truthy
      expect(() => parseEnv(env), `AUTH_TEST_MODE=${truthy}`).toThrow(/AUTH_TEST_MODE/)
    }
  })

  it('parses AUTH_TEST_MODE to a boolean and defaults it to false', () => {
    const enabled = parseEnv({
      NODE_ENV: 'development',
      AUTH_TEST_MODE: 'true',
      DATABASE_URL: 'postgresql://localhost/db',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'minioadmin',
      S3_SECRET_ACCESS_KEY: 'minioadmin',
      S3_BUCKET: 'simtrack-dev',
    })
    expect(enabled.AUTH_TEST_MODE).toBe(true)

    const unset = parseEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/db',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'minioadmin',
      S3_SECRET_ACCESS_KEY: 'minioadmin',
      S3_BUCKET: 'simtrack-dev',
    })
    expect(unset.AUTH_TEST_MODE).toBe(false)
  })
})
