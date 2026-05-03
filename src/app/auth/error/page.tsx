const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked: 'This email is already linked to a different sign-in method.',
  EmailSignin: 'Failed to send the sign-in email. Please try again.',
  OAuthCallbackError: 'Sign in with Google failed. Please try again.',
  SessionRequired: 'Please sign in to access this page.',
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : undefined
  const message = (error && errorMessages[error]) ?? 'An authentication error occurred.'

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Authentication error</h1>
      <p>{message}</p>
      <a href="/auth/signin">Back to sign in</a>
    </main>
  )
}
