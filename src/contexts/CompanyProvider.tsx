'use client'
// ─────────────────────────────────────────────────────────────────────────
// src/contexts/CompanyProvider.tsx — Source de vérité UNIQUE du dossier actif
//
// Remplace les 9 instances indépendantes de useActiveCompany() (qui re-fetchaient
// chacune) par UN seul contexte monté au layout.
//
// • Hydratation serveur : `initialCompanies` est chargé côté serveur dans le
//   layout (RLS appliquées) et passé en prop → le Provider démarre DÉJÀ peuplé,
//   donc aucun fetch au démarrage et aucun flash d'état vide.
// • `activeId` : préférence d'interface, gérée côté client (localStorage),
//   validée contre la liste des dossiers de l'utilisateur.
// • `refresh()` : recharge la liste après création/suppression d'un dossier,
//   sans rechargement de page.
// ─────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

const KEY = 'alvio-active-company'

export interface Company {
  id: string
  nom: string
  siren: string | null
  entreprise: any | null
  is_default: boolean
}

export interface CompanyContextValue {
  companies: Company[]
  activeId: string | null
  activeCompany: Company | null
  setActiveId: (id: string) => void
  refresh: () => Promise<void>
  loading: boolean
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

function loadStoredId(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(KEY) } catch { return null }
}

function persistId(id: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, id) } catch {}
}

function clearStoredId() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(KEY) } catch {}
}

// Résout le dossier actif : l'ID stocké s'il appartient à la liste, sinon le
// dossier par défaut, sinon le premier. Purge le localStorage si l'ID est orphelin.
function resolveActiveId(list: Company[]): string | null {
  const stored = loadStoredId()
  const valid = stored && list.some(c => c.id === stored) ? stored : null
  if (!valid) clearStoredId()
  const fallback = list.find(c => c.is_default)?.id || list[0]?.id || null
  const resolved = valid || fallback
  if (resolved) persistId(resolved)
  return resolved
}

export function CompanyProvider({
  initialCompanies,
  children,
}: {
  initialCompanies: Company[]
  children: ReactNode
}) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  // Résolu de façon synchrone dès le 1er rendu à partir des données serveur.
  const [activeId, _setActiveId] = useState<string | null>(() => resolveActiveId(initialCompanies))
  // Hydraté côté serveur → pas de chargement initial.
  const [loading] = useState(false)

  const setActiveId = useCallback((id: string) => {
    _setActiveId(id)
    persistId(id)
  }, [])

  // Recharge la liste des dossiers (après création / suppression).
  const refresh = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setCompanies([]); _setActiveId(null); clearStoredId(); return }
    const { data } = await sb
      .from('companies')
      .select('id, nom, siren, entreprise, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    const list = (data || []) as Company[]
    setCompanies(list)
    _setActiveId(resolveActiveId(list))
  }, [])

  const activeCompany = companies.find(c => c.id === activeId) || null

  return (
    <CompanyContext.Provider value={{ companies, activeId, activeCompany, setActiveId, refresh, loading }}>
      {children}
    </CompanyContext.Provider>
  )
}

// Lecteur du contexte — garde-fou explicite si utilisé hors du Provider.
export function useCompanyContext(): CompanyContextValue {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompanyContext doit être utilisé dans <CompanyProvider>')
  return ctx
}
