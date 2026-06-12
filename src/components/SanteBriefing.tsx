'use client'
// ─────────────────────────────────────────────────────────────────────────
// src/components/SanteBriefing.tsx
//
// Calcule le texte narratif de la page Santé financière par template,
// puis délègue tout le rendu à AlvioBlock.
// Aucune phrase sur une valeur manquante (règle Valentin — jamais de NaN).
// ─────────────────────────────────────────────────────────────────────────

import AlvioBlock from '@/components/AlvioBlock'
import type { HealthMetrics } from '@/lib/health-metrics'

interface SigLike {
  resultatNet: number
  is: number
  ca: number
}

interface SanteBriefingProps {
  sante: HealthMetrics
  sig: SigLike
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${parseInt(m[3])} ${MOIS[parseInt(m[2]) - 1]} ${m[1]}`
}

export default function SanteBriefing({ sante, sig }: SanteBriefingProps) {
  const phrases: string[] = []

  // 1 — Trésorerie
  if (sante.cash.ok) {
    phrases.push(`Trésorerie de ${fmtEur(sante.cash.value)}.`)
  }

  // 2 — Résultat net certifié
  if (typeof sig?.resultatNet === 'number') {
    phrases.push(`Résultat net de ${fmtEur(sig.resultatNet)} sur la période.`)
  }

  // 3 — Cycle d'exploitation
  if (
    sante.delaiClients.ok && sante.delaiClients.value.representatif &&
    sante.delaiFournisseurs.ok && sante.delaiFournisseurs.value.representatif
  ) {
    const dc = sante.delaiClients.value.jours
    const df = sante.delaiFournisseurs.value.jours
    phrases.push(
      dc <= df
        ? `Ton cycle te finance : tu encaisses en ${dc} j et règles en ${df} j.`
        : `Attention au cycle : tu encaisses en ${dc} j mais règles en ${df} j.`
    )
  }

  // 4 — Créances en retard
  if (sante.agingClients.ok && sante.agingClients.value.over60 > 0) {
    phrases.push(
      `Point de vigilance : ${fmtEur(sante.agingClients.value.over60)} de créances dépassent 60 jours.`
    )
  }

  if (phrases.length === 0) {
    phrases.push('Données insuffisantes pour établir un diagnostic sur cette période.')
  }

  // Pied de bloc : fraîcheur
  let fraicheur: string | undefined
  if (sante.freshness.ok) {
    const f = sante.freshness.value
    const pct = Math.round(f.coverageRatio * 100)
    fraicheur = `Données à jour au ${fmtDate(f.lastEntryDate)} · exercice saisi à ${pct} %.`
  }

  return (
    <AlvioBlock
      text={phrases.join(' ')}
      loading={false}
      statusLabel="CFO Digital"
      marginBottom={16}
      footer={fraicheur}
    />
  )
}
