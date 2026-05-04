import styles from './Plumbob.module.css'

interface PlumbobProps {
  width?: number
}

export function Plumbob({ width = 260 }: PlumbobProps) {
  const height = Math.round(width * 1.1)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 110"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon points="50,5 5,57 50,66"    fill="var(--plumbob-tl)" />
      <polygon points="50,5 95,57 50,66"   fill="var(--plumbob-tr)" />
      <polygon points="50,105 5,57 50,66"  fill="var(--plumbob-bl)" />
      <polygon points="50,105 95,57 50,66" fill="var(--plumbob-br)" />
      <polygon points="50,5 5,57 27,31"    fill="rgba(255,255,255,0.16)" />
    </svg>
  )
}

export function BigPlumbob({ width = 260 }: PlumbobProps) {
  const radius = Math.round(width * 0.115)
  return (
    <span
      className={styles.bigWrap}
      style={{ width, height: width }}
      aria-hidden="true"
    >
      <span
        className={styles.bigInner}
        style={{ borderRadius: radius }}
      />
    </span>
  )
}

export function MiniPlumbob({ size = 16 }: { size?: number }) {
  const inner = Math.round(size * 0.625)
  return (
    <span
      className={styles.miniWrap}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className={styles.miniInner}
        style={{ width: inner, height: inner }}
      />
    </span>
  )
}
