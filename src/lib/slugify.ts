import type { PrismaClient } from '@prisma/client'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function uniqueSlug(
  db: Pick<PrismaClient, 'legacy'>,
  userId: string,
  name: string,
): Promise<string> {
  const base = slugify(name)
  const existing = await db.legacy.findMany({
    where: { userId, slug: { startsWith: base } },
    select: { slug: true },
  })
  const slugSet = new Set(existing.map((l) => l.slug))
  if (!slugSet.has(base)) return base
  let i = 2
  while (slugSet.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}
