import Link from 'next/link'
import styles from './page.module.css'

function PlumbobSvg({ width = 260 }: { width?: number }) {
  const height = Math.round(width * 1.1)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 110"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pb-tl" x1="0%" y1="0%" x2="90%" y2="110%">
          <stop offset="0%" stopColor="#8fffc4" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="pb-tr" x1="100%" y1="0%" x2="10%" y2="110%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#22b87e" />
        </linearGradient>
        <linearGradient id="pb-bl" x1="0%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#166f4a" />
          <stop offset="100%" stopColor="#0a4530" />
        </linearGradient>
        <linearGradient id="pb-br" x1="100%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stopColor="#0f5c3e" />
          <stop offset="100%" stopColor="#073322" />
        </linearGradient>
      </defs>
      <polygon points="50,5 5,57 50,66" fill="url(#pb-tl)" />
      <polygon points="50,5 95,57 50,66" fill="url(#pb-tr)" />
      <polygon points="50,105 5,57 50,66" fill="url(#pb-bl)" />
      <polygon points="50,105 95,57 50,66" fill="url(#pb-br)" />
      <polygon points="50,5 5,57 27,31" fill="rgba(255,255,255,0.16)" />
      <line x1="50" y1="5" x2="50" y2="105" stroke="rgba(0,0,0,0.08)" strokeWidth="0.6" />
      <line x1="5" y1="57" x2="95" y2="57" stroke="rgba(0,0,0,0.08)" strokeWidth="0.6" />
    </svg>
  )
}

function MiniPlumbob() {
  return (
    <svg width="14" height="15" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="50,5 5,57 50,66" fill="#8fffc4" />
      <polygon points="50,5 95,57 50,66" fill="#34d399" />
      <polygon points="50,105 5,57 50,66" fill="#166f4a" />
      <polygon points="50,105 95,57 50,66" fill="#0a4530" />
    </svg>
  )
}

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
        <Link href="/auth/signin" className={styles.navSignIn}>
          Sign in
        </Link>
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
            <PlumbobSvg width={260} />
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
          <PlumbobSvg width={80} />
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
