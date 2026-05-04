import styles from './error.module.css'

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
    <main className={styles.page}>
      <h1 className={styles.title}>Authentication error</h1>
      <p className={styles.message}>{message}</p>
      <a href="/auth/signin" className={styles.link}>Back to sign in</a>
    </main>
  )
}
