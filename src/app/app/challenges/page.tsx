import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import {
  listChallenges,
  normalizeQuery,
  normalizeTab,
  type ChallengeTab,
} from '@/server/lib/challengeBrowse'
import { ChallengeGrid } from './_components/challenge-grid'
import { ChallengeSearch } from './_components/challenge-search'
import styles from './page.module.css'

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const TABS: { value: ChallengeTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'public', label: 'Public' },
]

function tabHref(tab: ChallengeTab, q: string): string {
  const params = new URLSearchParams()
  if (tab !== 'all') params.set('tab', tab)
  if (q) params.set('q', q)
  const qs = params.toString()
  return qs ? `/app/challenges?${qs}` : '/app/challenges'
}

export default async function ChallengesPage({ searchParams }: Props) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  const params = await searchParams
  const tab = normalizeTab(params.tab)
  const q = normalizeQuery(params.q)

  const challenges = await listChallenges(userId, { q, tab })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Challenges</h1>
        <ChallengeSearch />
      </div>

      <nav className={styles.tabs} aria-label="Filter challenges">
        {TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={tabHref(value, q)}
            className={cn(styles.tab, tab === value && styles.tabActive)}
            aria-current={tab === value ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      <ChallengeGrid
        challenges={challenges.map((challenge) => ({
          id: challenge.id,
          name: challenge.name,
          description: challenge.description,
          isYours: challenge.ownerId === userId,
          phaseCount: challenge._count.phases,
        }))}
        tab={tab}
        query={q}
      />
    </div>
  )
}
