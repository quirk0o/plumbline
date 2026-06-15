import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import Credentials from 'next-auth/providers/credentials'
import type { EmailConfig } from '@auth/core/providers'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './src/server/db'
import { env } from './src/server/env'
import { authConfig } from './auth.config'
import { buildAuthProviders } from './src/server/auth-providers'

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
  env.NODE_ENV === 'production'
    ? Resend({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM })
    : devEmailProvider

// Passwordless login-as-anyone for E2E. Registered ONLY when test mode is on
// (see buildAuthProviders); the env module additionally hard-fails if
// AUTH_TEST_MODE=true in production, so it can never reach a real deployment.
const testProvider = Credentials({
  id: 'test',
  credentials: { email: { type: 'text' } },
  authorize: async ({ email }) =>
    db.user.upsert({
      where: { email: email as string },
      update: {},
      create: { email: email as string, name: 'E2E Test User' },
    }),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: buildAuthProviders({
    baseProviders: authConfig.providers,
    emailProvider,
    testProvider,
    isTestMode: env.AUTH_TEST_MODE,
  }),
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
