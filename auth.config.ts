import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    newUser: '/app/onboarding/packs',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth: session }) {
      return !!session
    },
  },
}
