import { db } from '@/server/db'

/**
 * A caller-injectable db client whose given model operation always throws —
 * for asserting transactional rollback. Query extensions apply inside
 * interactive transactions too, so the fault fires within $transaction.
 */
export function failingDb(model: string, operation: string): typeof db {
  // The computed keys defeat $extends's mapped-type inference (it expects
  // literal model/operation names), so the argument is cast once here; the
  // call sites stay cast-free.
  const extension = {
    query: {
      [model]: {
        [operation]() {
          throw new Error(`injected failure: ${model}.${operation}`)
        },
      },
    },
  }
  return db.$extends(extension as never) as unknown as typeof db
}
