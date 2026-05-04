'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import styles from './AppNav.module.css'

interface AppNavProps {
  name: string | null
  email: string | null
  image: string | null
}

function MiniPlumbob() {
  return (
    <svg width="14" height="15" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="50,5 5,57 50,66" fill="#8fffc4" />
      <polygon points="50,5 95,57 50,66" fill="#34d399" />
      <polygon points="50,105 5,57 50,66" fill="#166f4a" />
      <polygon points="50,105 95,57 50,66" fill="#0a4530" />
    </svg>
  )
}

export function AppNav({ name, email, image }: AppNavProps) {
  const pathname = usePathname()
  const initial = (name ?? email ?? '?')[0].toUpperCase()

  const isActive = (href: string) =>
    href === '/app' ? pathname === '/app' : pathname.startsWith(href)

  return (
    <nav className={styles.nav}>
      <Link href="/app" className={styles.logo}>
        <MiniPlumbob />
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
