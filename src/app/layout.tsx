import type { Metadata } from 'next'
import { TRPCProvider } from '@/trpc/Provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'SimsTrack',
  description: 'Track your Sims game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}
