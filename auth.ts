import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [...authConfig.providers, emailProvider],
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
