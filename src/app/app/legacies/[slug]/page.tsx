import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
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
      sims: {
        select: { id: true, firstName: true, lastName: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!legacy) notFound()

  return (
    <div className={styles.page}>
      <div className={`${styles.hero} ${!legacy.imageUrl ? styles.heroNoImage : ''}`}>
        {legacy.imageUrl && (
          <Image
            src={legacy.imageUrl}
            alt={legacy.name}
            fill
            className={styles.heroImage}
            sizes="(max-width: 800px) 100vw, 800px"
          />
        )}
        {legacy.imageUrl && <div className={styles.heroOverlay} />}
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Legacy</p>
          <h1 className={styles.title}>{legacy.name}</h1>
          {legacy.description && <p className={styles.description}>{legacy.description}</p>}
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Founder</h2>
        </div>
        {legacy.founderSim ? (
          <div className={styles.founderCard}>
            {legacy.founderSim.imageUrl && (
              <div className={styles.founderAvatarWrap}>
                <Image
                  src={legacy.founderSim.imageUrl}
                  alt={legacy.founderSim.firstName}
                  fill
                  className={styles.founderAvatar}
                  sizes="88px"
                />
              </div>
            )}
            <div className={styles.founderInfo}>
              <p className={styles.founderEyebrow}>Founder</p>
              <div className={styles.founderMeta}>
                <span className={styles.founderName}>
                  {legacy.founderSim.firstName} {legacy.founderSim.lastName}
                </span>
                <span className={styles.generationBadge}>Gen I</span>
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
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Sims</h2>
          <Link href={`/app/legacies/${slug}/sims/new`} className={styles.addSimLink}>
            Add sim
          </Link>
        </div>
        {legacy.sims.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.empty}>No sims yet.</p>
            <Link href={`/app/legacies/${slug}/sims/new`} className={styles.emptyAction}>
              Add your first sim →
            </Link>
          </div>
        ) : (
          <ul className={styles.simList}>
            {legacy.sims.map((sim) => (
              <li key={sim.id} className={styles.simCard}>
                <span className={styles.simName}>
                  {sim.firstName} {sim.lastName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
