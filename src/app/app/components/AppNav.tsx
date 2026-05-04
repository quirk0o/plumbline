'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Plumbob } from '@/components/Plumbob'
import { ThemeToggle } from '@/components/ThemeProvider'
import styles from './AppNav.module.css'

interface AppNavProps {
  name: string | null
  email: string | null
  image: string | null
}

export function AppNav({ name, email, image }: AppNavProps) {
  const pathname = usePathname()
  const initial = (name ?? email ?? '?')[0].toUpperCase()

  const isActive = (href: string) =>
    href === '/app' ? pathname === '/app' : pathname.startsWith(href)

  return (
    <nav className={styles.nav}>
      <Link href="/app" className={styles.logo}>
        <Plumbob size={16} />
        SimsTrack
      </Link>

      <div className={styles.links}>
        <Link
          href="/app"
          className={`${styles.link} ${isActive('/app') ? styles.linkActive : ''}`}
        >
          Dashboard
        </Link>
        <Link
          href="/app/settings/packs"
          className={`${styles.link} ${isActive('/app/settings') ? styles.linkActive : ''}`}
        >
          Settings
        </Link>
      </div>

      <div className={styles.user}>
        <ThemeToggle />
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name ?? ''} className={styles.avatar} />
        ) : (
          <div className={styles.avatarInitial}>{initial}</div>
        )}
        <button
          className={styles.signOut}
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
