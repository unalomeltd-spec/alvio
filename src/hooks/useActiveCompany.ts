'use client'
// ─────────────────────────────────────────────────────────────────────────
// src/hooks/useActiveCompany.ts — Lecteur du dossier actif
//
// Depuis l'introduction de <CompanyProvider> (monté au layout), ce hook n'a
// plus de logique propre : il lit la source de vérité UNIQUE du contexte.
// La signature de retour est INCHANGÉE pour les pages existantes
// ({ companies, activeId, activeCompany, setActiveId, loading }), avec en plus
// `refresh()` pour recharger la liste après création/suppression d'un dossier.
// ─────────────────────────────────────────────────────────────────────────

import { useCompanyContext, type Company, type CompanyContextValue } from '@/contexts/CompanyProvider'

export type { Company, CompanyContextValue }

export function useActiveCompany(): CompanyContextValue {
  return useCompanyContext()
}
