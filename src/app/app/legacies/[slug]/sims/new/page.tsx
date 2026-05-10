import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { AddSimClient } from './add-sim-client'
import { fetchTraitsWithConflicts, fetchAspirations, fetchCareers } from '@/lib/reference-data'
import styles from './page.module.css'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function AddSimPage({ params }: Props) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const legacy = await db.legacy.findFirst({ where: { slug, userId: session.user.id } })
  if (!legacy) notFound()

  const [traits, aspirations, careers] = await Promise.all([
    fetchTraitsWithConflicts(),
    fetchAspirations(),
    fetchCareers(),
  ])

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Add Sim to {legacy.name}</h1>
      <div className={styles.card}>
        <AddSimClient
          legacyId={legacy.id}
          slug={slug}
          traits={traits}
          aspirations={aspirations}
          careers={careers}
        />
      </div>
    </div>
  )
}
