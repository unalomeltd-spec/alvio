'use client'
// Brief narratif de la page Santé financière (couche 1).
// Narratif par template : chaque phrase n'est générée que si sa donnée est
// disponible (Metric.ok). Aucune phrase sur une valeur manquante → jamais de
// NaN ni de zéro silencieux (règle Valentin). Le résultat normalisé reste en
// retrait tant que la règle d'estimation n'est pas validée.

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

  // 1 — Trésorerie (le chiffre roi en temps réel)
  if (sante.cash.ok) {
    phrases.push(`Trésorerie de ${fmtEur(sante.cash.value)}.`)
  }

  // 2 — Résultat (brut certifié ; le normalisé arrivera après arbitrage)
  if (typeof sig?.resultatNet === 'number') {
    phrases.push(`Résultat net de ${fmtEur(sig.resultatNet)} sur la période.`)
  }

  // 3 — Cycle d'exploitation : qui finance qui ?
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

  // 4 — Vigilance : argent dehors
  if (sante.agingClients.ok && sante.agingClients.value.over60 > 0) {
    phrases.push(
      `Point de vigilance : ${fmtEur(sante.agingClients.value.over60)} de créances dépassent 60 jours.`
    )
  }

  // Suffixe de fraîcheur (confiance dans la photo)
  let fraicheur = ''
  if (sante.freshness.ok) {
    const f = sante.freshness.value
    const pct = Math.round(f.coverageRatio * 100)
    fraicheur = `Données à jour au ${fmtDate(f.lastEntryDate)} · exercice saisi à ${pct} %.`
  }

  if (phrases.length === 0) {
    phrases.push('Données insuffisantes pour établir un diagnostic sur cette période.')
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l2 5 4-12 2 7h6" />
          </svg>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>Alvio</div>
        <span style={{ fontSize: 10, color: '#1D9E75', background: 'rgba(29,158,117,0.08)', border: '0.5px solid rgba(29,158,117,0.2)', padding: '2px 8px', borderRadius: 10 }}>CFO Digital</span>
      </div>
      <div style={{ fontSize: 13, color: '#3A3A3A', lineHeight: 1.7 }}>
        {phrases.join(' ')}
      </div>
      {fraicheur && (
        <div style={{ fontSize: 11, color: '#8C9BAB', marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(0,0,0,0.05)' }}>
          {fraicheur}
        </div>
      )}
    </div>
  )
}
