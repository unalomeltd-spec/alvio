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
    <div style={{
      marginBottom: 16,
      background: '#fff',
      border: '0.5px solid rgba(184,169,138,0.3)',
      borderLeft: '3px solid #B8A98A',
      borderRadius: '0 12px 12px 0',
      padding: '16px 20px',
    }}>
      {/* Header — identique AlvioInsight */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(184,169,138,0.12)',
          border: '0.5px solid rgba(184,169,138,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
            <circle cx="14" cy="14" r="2.5" fill="#fff"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', letterSpacing: '0.02em' }}>Alvio</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} />
            <span style={{ fontSize: 10, color: '#8C9BAB' }}>CFO Digital</span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.7, letterSpacing: '0.01em' }}>
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
