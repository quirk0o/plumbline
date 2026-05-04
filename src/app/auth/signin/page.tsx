import { Suspense } from 'react'
import SignInForm from './SignInForm'
import { Plumbob } from '@/components/Plumbob'
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
          <h1 className={styles.title}>SimsTrack</h1>
          <p className={styles.subtitle}>Your Sims universe, tracked</p>
        </div>

        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  )
}
