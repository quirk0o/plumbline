import { test as teardown } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'e2e-test@simtrack.test'

teardown('delete test user', async () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const db = new PrismaClient({ adapter })
  await db.user.deleteMany({ where: { email: TEST_EMAIL } })
  await db.$disconnect()
})
