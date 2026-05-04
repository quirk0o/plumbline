import { NextResponse } from 'next/server'
import { auth } from '../auth'

export const proxy = auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(signInUrl)
  }
})

export const config = {
  matcher: ['/((?!auth|api/auth|_next/static|_next/image|favicon.ico).+)'],
}
