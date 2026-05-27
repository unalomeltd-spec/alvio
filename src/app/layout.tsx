import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alvio — L\'intelligence financière en temps réel',
  description: 'Le CFO digital des dirigeants de TPE/PME françaises.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
