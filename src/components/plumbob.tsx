import styles from './plumbob.module.css'

interface PlumbobProps {
  size?: number
  glow?: boolean
  pulse?: boolean
}

export function Plumbob({ size = 260, glow = false, pulse = false }: PlumbobProps) {
  const cls = [styles.wrap, glow && styles.withGlow, pulse && styles.withPulse].filter(Boolean).join(' ')
  return (
    <span
      className={cls}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className={styles.inner}
        style={{ width: size, height: size }}
      />
    </span>
  )
}
