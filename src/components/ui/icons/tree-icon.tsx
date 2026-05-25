export interface TreeIconProps {
  className?: string
}

export function TreeIcon({ className }: TreeIconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="7" cy="2.5" r="1.5" />
      <circle cx="3" cy="11" r="1.5" />
      <circle cx="11" cy="11" r="1.5" />
      <path d="M7 4 V 7 M3 9.5 V 7 H 11 V 9.5" />
    </svg>
  )
}
