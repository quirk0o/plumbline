import Link from 'next/link'
import { Plumbob, MiniPlumbob } from '@/components/Plumbob'
import { ThemeToggle } from '@/components/ThemeProvider'
import styles from './page.module.css'

const features = [
  {
    title: 'Legacy Chronicles',
    description: 'Document multi-generational family sagas from the founding Sim all the way to the tenth heir and beyond.',
  },
  {
    title: 'Sim Profiles',
    description: 'Rich character sheets capturing life stage, gender, occult type, cause of death, and every identity detail.',
  },
  {
    title: 'Family Trees',
    description: 'Map biological, adoptive, and step-family bonds — and visualize how each generation connects.',
  },
  {
    title: 'Skills & Careers',
    description: 'Track skill levels, career branches, and every professional milestone across your Sims\' working lives.',
  },
  {
    title: 'Traits & Aspirations',
    description: 'Record personality traits, bonus traits from aspirations, and mark completed aspiration milestones.',
  },
  {
    title: 'Social Bonds',
    description: 'Chronicle friendships, romances, engagements, marriages — and every heartbreak and rivalry.',
  },
]

export default function Home() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <MiniPlumbob />
          <span>SimsTrack</span>
        </div>
        <div className={styles.navRight}>
          <ThemeToggle />
          <Link href="/auth/signin" className={styles.navSignIn}>
            Sign in
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>
            <MiniPlumbob />
            Legacy Challenge Companion
          </p>
          <h1 className={styles.headline}>
            Every generation,<br />
            every <em>story.</em>
          </h1>
          <p className={styles.description}>
            SimsTrack is your dedicated chronicle for Sims legacies.
            Track every Sim, household, relationship, and milestone
            across generations of gameplay — nothing forgotten, everything remembered.
          </p>
          <Link href="/auth/signin" className={styles.ctaButton}>
            Start your chronicle
            <span className={styles.ctaArrow}>→</span>
          </Link>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.glowOuter} />
          <div className={styles.glowInner} />
          <div className={styles.plumbobWrapper}>
            <Plumbob width={260} />
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerGem}><MiniPlumbob /></span>
        <span className={styles.dividerLine} />
      </div>

      <section className={styles.features}>
        <header className={styles.featuresHeader}>
          <h2 className={styles.featuresTitle}>Everything your legacy deserves</h2>
          <p className={styles.featuresSubtitle}>Built for the Simmer who leaves nothing untracked.</p>
        </header>
        <div className={styles.featuresGrid}>
          {features.map((feature) => (
            <article key={feature.title} className={styles.featureCard}>
              <div className={styles.featureGem}><MiniPlumbob /></div>
              <h3 className={styles.featureName}>{feature.title}</h3>
              <p className={styles.featureDesc}>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaDecor}>
          <div className={styles.ctaGlow} />
          <Plumbob width={80} />
        </div>
        <h2 className={styles.ctaTitle}>Begin your legacy today.</h2>
        <p className={styles.ctaSubtitle}>Free to use. Your stories, always remembered.</p>
        <Link href="/auth/signin" className={styles.ctaButton}>
          Get started
          <span className={styles.ctaArrow}>→</span>
        </Link>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <MiniPlumbob />
          <span>SimsTrack</span>
        </div>
        <p className={styles.footerCopy}>© 2026</p>
      </footer>
    </div>
  )
}
