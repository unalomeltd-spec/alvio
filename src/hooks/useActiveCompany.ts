'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const sb = createClient()

const KEY = 'alvio-active-company'
const EVENT = 'alvio-company-changed'

export interface Company {
  id: string
  nom: string
  siren: string | null
  entreprise: any | null
  is_default: boolean
}

function loadActiveId(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(KEY) } catch { return null }
}

function persistActiveId(id: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, id) } catch {}
}

// Hook central du dossier actif.
// Charge les dossiers (companies) de l'utilisateur, expose l'actif + le sélecteur.
// Au changement de dossier : émet un événement custom que toutes les pages écoutent
// pour relancer leurs fetchs (rafraîchissement sans reload).
export function useActiveCompany() {
  const [companies, setCompanies] = useState<Company[]>([])
  // Init synchrone depuis le localStorage (évite le trou où activeId=null au 1er rendu).
  // La validation ci-dessous purge l'ID s'il n'appartient pas à l'utilisateur connecté.
  const [activeId, _setActiveId] = useState<string | null>(loadActiveId())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const charger = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await sb.auth.getUser()
        if (!user) {
          // User déconnecté : purger le localStorage
          try { localStorage.removeItem('alvio-active-company') } catch {}
          setLoading(false); return
        }
        const { data } = await sb
          .from('companies')
          .select('id, nom, siren, entreprise, is_default')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true })
        const list = (data || []) as Company[]
        setCompanies(list)
        // Valider le localStorage APRÈS avoir chargé les dossiers du user connecté
        const saved = loadActiveId()
        const validSaved = saved && list.some(c => c.id === saved) ? saved : null
        if (!validSaved) {
          // L'ID stocké n'appartient pas à ce user — purger et prendre le fallback
          try { localStorage.removeItem('alvio-active-company') } catch {}
        }
        const fallback = list.find(c => c.is_default)?.id || list[0]?.id || null
        const resolved = validSaved || fallback
        if (resolved) { _setActiveId(resolved); persistActiveId(resolved) }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    charger()
    // Écoute les changements de dossier émis par d'autres instances du hook
    const onChange = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (id) _setActiveId(id)
    }
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  const setActiveId = useCallback((id: string) => {
    _setActiveId(id)
    persistActiveId(id)
    // Notifie toutes les autres instances du hook (TopBar + page courante)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
    }
  }, [])

  const activeCompany = companies.find(c => c.id === activeId) || null

  return { companies, activeId, activeCompany, setActiveId, loading }
}
