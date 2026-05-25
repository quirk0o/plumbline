import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import styles from './portrait-avatar.module.css'

export interface PortraitAvatarProps {
  imageUrl?: string | null
  firstName: string
  lastName: string
  size?: number
  ring?: 'founder' | 'heir' | 'green'
  /** When set, the avatar becomes a link (e.g. to the sim's detail page). */
  href?: string
  /** Accessible name for the link; defaults to "View {firstName} {lastName}". */
  ariaLabel?: string
  className?: string
}

export function PortraitAvatar({
  imageUrl,
  firstName,
  lastName,
  size = 56,
  ring = 'green',
  href,
  ariaLabel,
  className,
}: PortraitAvatarProps) {
  const isAccent = ring === 'founder' || ring === 'heir'
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`

  const accentRingStyle = isAccent
    ? { boxShadow: '0 0 0 2px var(--bg-card), 0 0 0 3px var(--amber)' }
    : {}

  // When linked, the className lands on the <Link>; otherwise on the avatar root.
  const rootClass = href ? undefined : className

  const avatar = imageUrl ? (
    <div
      className={cn(styles.photoContainer, rootClass)}
      style={{ width: size, height: size, ...accentRingStyle }}
    >
      <Image
        src={imageUrl}
        alt={href ? '' : `${firstName} ${lastName}`}
        width={size}
        height={size}
        style={{ objectFit: 'cover' }}
      />
    </div>
  ) : (
    <div
      className={cn(styles.monogram, isAccent && styles.accentMonogram, rootClass)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        ...accentRingStyle,
      }}
    >
      <span
        className={cn(styles.innerRing, isAccent && styles.accentInnerRing)}
        style={{ inset: Math.max(3, Math.round(size * 0.08)) }}
        aria-hidden="true"
      />
      {initials}
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn(styles.link, className)}
        aria-label={ariaLabel ?? `View ${firstName} ${lastName}`}
      >
        {avatar}
      </Link>
    )
  }

  return avatar
}
