import { z } from 'zod'

/**
 * Validates an image URL stored on a Sim or Legacy.
 *
 * Allowed:
 * - `/media/...`   — current uploads served via the presigned-redirect route
 * - `/uploads/...` — legacy local uploads (backward compatibility; see backfill script)
 * - `*.vercel-storage.com` — historical Vercel Blob rows
 * - `localhost`    — local OAuth avatar / dev URLs
 */
export const imageUrlSchema = z
  .string()
  .refine(
    (url) => {
      if (url.startsWith('/media/') || url.startsWith('/uploads/')) return true
      try {
        const { hostname } = new URL(url)
        return hostname.endsWith('.vercel-storage.com') || hostname === 'localhost'
      } catch {
        return false
      }
    },
    { message: 'Image must be hosted on an allowed domain' },
  )
  .optional()
