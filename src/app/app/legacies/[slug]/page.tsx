import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import styles from './page.module.css'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function LegacyDetailPage({ params }: Props) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const legacy = await db.legacy.findFirst({
    where: { slug, userId: session.user.id },
    include: {
      founderSim: {
        include: {
          personalityTraits: { include: { personalityTrait: { select: { name: true } } } },
        },
      },
    },
  })

  if (!legacy) notFound()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        {legacy.imageUrl && (
          <div className={styles.coverWrap}>
            <Image src={legacy.imageUrl} alt={legacy.name} fill className={styles.cover} sizes="80px" />
          </div>
        )}
        <div>
          <h1 className={styles.title}>{legacy.name}</h1>
          {legacy.description && <p className={styles.description}>{legacy.description}</p>}
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Founder</h2>
        {legacy.founderSim ? (
          <div className={styles.founderCard}>
            {legacy.founderSim.imageUrl && (
              <div className={styles.founderAvatarWrap}>
                <Image src={legacy.founderSim.imageUrl} alt={legacy.founderSim.firstName} fill className={styles.founderAvatar} sizes="56px" />
              </div>
            )}
            <div>
              <div className={styles.founderName}>
                {legacy.founderSim.firstName} {legacy.founderSim.lastName}
              </div>
              {legacy.founderSim.personalityTraits.length > 0 && (
                <div className={styles.traitList}>
                  {legacy.founderSim.personalityTraits.map(({ personalityTrait }) => (
                    <span key={personalityTrait.name} className={styles.traitChip}>
                      {personalityTrait.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className={styles.empty}>No founder set.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sims</h2>
        <p className={styles.empty}>Sim tracking coming soon.</p>
      </section>
    </div>
  )
}
