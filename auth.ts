import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import Credentials from 'next-auth/providers/credentials'
import type { EmailConfig } from '@auth/core/providers'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './src/server/db'
import { authConfig } from './auth.config'

const devEmailProvider: EmailConfig = {
  id: 'email',
  type: 'email',
  name: 'Email',
  from: 'dev@localhost',
  maxAge: 24 * 60 * 60,
  sendVerificationRequest({ identifier, url }) {
    console.log(`\n[Auth] Magic link for ${identifier}:\n${url}\n`)
  },
  options: {},
}

const emailProvider =
  process.env.NODE_ENV === 'production'
    ? Resend({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM })
    : devEmailProvider

// Only active when AUTH_TEST_MODE=true — never set this in production or .env.test
const testProvider = Credentials({
  id: 'test',
  credentials: { email: { type: 'text' } },
  authorize: async ({ email }) => {
    if (process.env.AUTH_TEST_MODE !== 'true') return null
    return db.user.upsert({
      where: { email: email as string },
      update: {},
      create: { email: email as string, name: 'E2E Test User' },
    })
  },
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [...authConfig.providers, emailProvider, testProvider],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
