'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MiniPlumbob } from '@/components/Plumbob'
import styles from './signin.module.css'

function GoogleIcon() {
  return (
    <svg className={styles.googleIcon} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function SignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/app'
  const error = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    await signIn('email', { email, callbackUrl, redirect: false })
    setEmailSent(true)
  }

  return (
    <div className={styles.form}>
      {error && (
        <p className={styles.error}>
          {error === 'OAuthAccountNotLinked'
            ? 'This email is already linked to a different sign-in method.'
            : 'Something went wrong. Please try again.'}
        </p>
      )}

      {emailSent ? (
        <div className={styles.success}>
          <span className={styles.successIcon}><MiniPlumbob size={44} /></span>
          <p className={styles.successTitle}>Check your inbox</p>
          <p className={styles.successText}>
            A sign-in link is on its way to<br />
            <strong>{email}</strong>
          </p>
        </div>
      ) : (
        <>
          <button
            className={styles.googleButton}
            onClick={() => signIn('google', { callbackUrl })}
            type="button"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <span className={styles.dividerLine} />
          </div>

          <form onSubmit={handleEmailSignIn} className={styles.emailForm}>
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
            <button type="submit" className={styles.submitButton}>
              Send magic link
            </button>
          </form>
        </>
      )}
    </div>
  )
}
