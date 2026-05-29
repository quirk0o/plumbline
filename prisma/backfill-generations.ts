import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL environment variable is not set')
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Pass 0: founders are always generation 1
  const legacies = await prisma.legacy.findMany({
    where: { founderSimId: { not: null } },
    select: { founderSimId: true },
  })
  const founderIds = legacies.flatMap((l) => (l.founderSimId ? [l.founderSimId] : []))
  let founderCount = 0
  if (founderIds.length > 0) {
    const result = await prisma.sim.updateMany({
      where: { id: { in: founderIds }, generationNumber: null },
      data: { generationNumber: 1 },
    })
    founderCount = result.count
  }
  console.log(`Founders assigned gen 1: ${founderCount}`)

  // BFS fixpoint: each pass assigns children whose parents now have known gens.
  // Mirrors the sims.create derivation: min(parent gens) + 1.
  // Only updates sims with generationNumber === null.
  let pass = 0
  let totalChildren = 0
  while (true) {
    pass++
    const nullSims = await prisma.sim.findMany({
      where: { generationNumber: null },
      select: {
        id: true,
        childOf: { select: { parent: { select: { generationNumber: true } } } },
      },
    })

    const updates: Array<{ id: string; gen: number }> = []
    for (const sim of nullSims) {
      const parentGens = sim.childOf
        .map((r) => r.parent.generationNumber)
        .filter((g): g is number => g !== null)
      if (parentGens.length > 0) {
        updates.push({ id: sim.id, gen: Math.min(...parentGens) + 1 })
      }
    }

    if (updates.length === 0) break

    await Promise.all(
      updates.map(({ id, gen }) =>
        prisma.sim.update({ where: { id }, data: { generationNumber: gen } }),
      ),
    )
    totalChildren += updates.length
    console.log(`Pass ${pass}: ${updates.length} sim(s) assigned`)
  }

  const unresolvable = await prisma.sim.count({ where: { generationNumber: null } })

  console.log(`\nDone.`)
  console.log(`  Founders: ${founderCount}`)
  console.log(`  Children: ${totalChildren} (across ${pass - 1} pass(es))`)
  if (unresolvable > 0) {
    console.log(`  Unresolvable (no parent chain): ${unresolvable}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
