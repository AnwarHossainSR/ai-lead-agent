import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mela — Lead generation workspace',
  description: 'Find leads. Draft outreach. Never send without you.',
  generator: 'Mela',
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#1d2029',
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
