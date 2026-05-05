import { Suspense } from 'react'
import SignInForm from './sign-in-form'
import { Plumbob } from '@/components/plumbob'
import styles from './signin.module.css'

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.plumbobWrap}>
          <div className={styles.plumbob}>
            <Plumbob size={44} glow pulse />
          </div>
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>SimTrack</h1>
          <p className={styles.subtitle}>Your Sims universe, tracked</p>
        </div>

        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  )
}
