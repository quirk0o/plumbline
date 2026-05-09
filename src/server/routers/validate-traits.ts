import { TRPCError } from '@trpc/server'
import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export async function assertNoTraitConflicts(db: Db, traitIds: string[]) {
  if (traitIds.length < 2) return
  const conflict = await db.personalityTraitConflict.findFirst({
    where: { traitAId: { in: traitIds }, traitBId: { in: traitIds } },
  })
  if (conflict) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selected traits conflict' })
}
