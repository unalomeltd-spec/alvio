import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Alvio — L'intelligence financière en temps réel",
  description: "Le CFO digital pour toutes les structures qui ont des comptes à tenir.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      </head>
      <body>{children}</body>
    </html>
  )
}
