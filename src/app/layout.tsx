import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ExitZero - AI-Native Retention Infrastructure',
  description: 'Reduce churn with AI-powered personalized offers, Q-learning optimization, and complete data ownership for SaaS companies.',
  keywords: ['AI', 'retention', 'churn', 'SaaS', 'Stripe', 'Supabase', 'machine learning'],
  authors: [{ name: 'ExitZero Team' }],
  creator: 'ExitZero',
  publisher: 'ExitZero',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://exitzero.com'),
  openGraph: {
    title: 'ExitZero - AI-Native Retention Infrastructure',
    description: 'Reduce churn with AI-powered personalized offers, Q-learning optimization, and complete data ownership.',
    url: 'https://exitzero.com',
    siteName: 'ExitZero',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ExitZero - AI-Native Retention Infrastructure',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ExitZero - AI-Native Retention Infrastructure',
    description: 'Reduce churn with AI-powered personalized offers, Q-learning optimization, and complete data ownership.',
    images: ['/og-image.png'],
    creator: '@exitzero',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
