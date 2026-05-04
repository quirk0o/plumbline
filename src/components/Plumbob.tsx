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

export function MiniPlumbob() {
  return (
    <svg
      width="14"
      height="15"
      viewBox="0 0 100 110"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon points="50,5 5,57 50,66"    fill="var(--plumbob-tl)" />
      <polygon points="50,5 95,57 50,66"   fill="var(--plumbob-tr)" />
      <polygon points="50,105 5,57 50,66"  fill="var(--plumbob-bl)" />
      <polygon points="50,105 95,57 50,66" fill="var(--plumbob-br)" />
    </svg>
  )
}
