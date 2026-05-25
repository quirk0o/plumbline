import Image from 'next/image'
import { cn } from '@/lib/utils'
import styles from './portrait-avatar.module.css'

export interface PortraitAvatarProps {
  imageUrl?: string | null
  firstName: string
  lastName: string
  size?: number
  ring?: 'founder' | 'heir' | 'green'
  className?: string
}

export function PortraitAvatar({
  imageUrl,
  firstName,
  lastName,
  size = 56,
  ring = 'green',
  className,
}: PortraitAvatarProps) {
  const isAccent = ring === 'founder' || ring === 'heir'
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`

  const accentRingStyle = isAccent
    ? { boxShadow: '0 0 0 2px var(--bg-card), 0 0 0 3px var(--amber)' }
    : {}

  if (imageUrl) {
    return (
      <div
        className={cn(styles.photoContainer, className)}
        style={{ width: size, height: size, ...accentRingStyle }}
      >
        <Image
          src={imageUrl}
          alt={`${firstName} ${lastName}`}
          width={size}
          height={size}
          style={{ objectFit: 'cover' }}
        />
      </div>
    )
  }

  const inset = Math.max(3, Math.round(size * 0.08))
  const fontSize = Math.round(size * 0.36)

  return (
    <div
      className={cn(styles.monogram, isAccent && styles.accentMonogram, className)}
      style={{
        width: size,
        height: size,
        fontSize,
        ...accentRingStyle,
      }}
    >
      <span
        className={cn(styles.innerRing, isAccent && styles.accentInnerRing)}
        style={{ inset }}
        aria-hidden="true"
      />
      {initials}
    </div>
  )
}
