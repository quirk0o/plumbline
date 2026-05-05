import type { Metadata } from 'next'
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google'
import Script from 'next/script'
import { SessionProvider } from 'next-auth/react'
import { TRPCProvider } from '@/trpc/provider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SimTrack',
  description: 'Chronicle your Sims legacies — track every generation, household, and story.',
}

const flashPreventionScript = `(function(){if('scrollRestoration'in history){history.scrollRestoration='manual'}try{var t=localStorage.getItem('simtrack-theme');var r=t==='dark'||t==='light'?t:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',r);}catch(e){}})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jakarta.variable}`} data-theme="light" suppressHydrationWarning>
      <body>
        <Script id="theme-flash-prevention" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: flashPreventionScript }} />
        <SessionProvider>
          <TRPCProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </TRPCProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
