import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { CompanyProvider, type Company } from '@/contexts/CompanyProvider'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Alvio — L'intelligence financière en temps réel",
  description: "Le CFO digital pour toutes les structures qui ont des comptes à tenir.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-icon.svg', type: 'image/svg+xml' },
    ],
  },
}

// Charge les dossiers de l'utilisateur CÔTÉ SERVEUR (client authentifié, RLS).
// Renvoie [] si pas de session (ex. page /login) — sans erreur.
async function getInitialCompanies(): Promise<Company[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('companies')
      .select('id, nom, siren, entreprise, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    return (data || []) as Company[]
  } catch {
    return []
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialCompanies = await getInitialCompanies()
  return (
    <html lang="fr" className={inter.className}>
      <body>
        <CompanyProvider initialCompanies={initialCompanies}>
          {children}
        </CompanyProvider>
      </body>
    </html>
  )
}
