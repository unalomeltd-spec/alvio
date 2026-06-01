'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePeriod } from '@/hooks/usePeriod'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import PeriodSelector from '@/components/PeriodSelector'
import AlvioInsight from '@/components/AlvioInsight'
import { filtrerLignes } from '@/hooks/useFEC'
import type { LigneFEC } from '@/hooks/useFEC'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)
  return d
}

function decalerAnMoins1(d: string): string {
  if (!d) return ''
  const y = parseInt(d.slice(0,4), 10)
  return (y - 1) + d.slice(4)
}

const PCG_GROUPES: Record<string, { prefixes: string[]; label: string; sign: 1|-1 }[]> = {
  venteMarchandises:  [{ prefixes:['707'], label:'Ventes de marchandises', sign:-1 }],
  coutMarchandises:   [{ prefixes:['607'], label:'Achats de marchandises', sign:1 }, { prefixes:['6037'], label:'Variation de stocks — marchandises', sign:1 }],
  prodVendue:         [{ prefixes:['701'], label:'Ventes de produits finis', sign:-1 }, { prefixes:['702'], label:'Ventes de produits intermédiaires', sign:-1 }, { prefixes:['703'], label:'Ventes de produits résiduels', sign:-1 }, { prefixes:['704'], label:'Travaux', sign:-1 }, { prefixes:['705'], label:'Études et prestations', sign:-1 }, { prefixes:['706'], label:'Prestations de services', sign:-1 }, { prefixes:['708'], label:'Produits des activités annexes', sign:-1 }],
  prodStockee:        [{ prefixes:['713'], label:'Variation des stocks (produits)', sign:-1 }],
  prodImmobilisee:    [{ prefixes:['72'], label:'Production immobilisée', sign:-1 }],
  consommationsExt:   [{ prefixes:['601'], label:'Achats stockés — matières premières', sign:1 }, { prefixes:['602'], label:'Achats stockés — autres appros', sign:1 }, { prefixes:['604'], label:'Achats d\'études et prestations', sign:1 }, { prefixes:['605'], label:'Achats de matériel et fournitures', sign:1 }, { prefixes:['606'], label:'Achats non stockés', sign:1 }, { prefixes:['608'], label:'Frais accessoires sur achats', sign:1 }, { prefixes:['609'], label:'Rabais, remises, ristournes obtenus', sign:-1 }, { prefixes:['61'], label:'Services extérieurs (sous-traitance, locations…)', sign:1 }, { prefixes:['62'], label:'Autres services extérieurs (honoraires, pub…)', sign:1 }],
  subventions:        [{ prefixes:['74'], label:'Subventions d\'exploitation', sign:-1 }],
  impotsTaxes:        [{ prefixes:['63'], label:'Impôts, taxes et versements assimilés', sign:1 }],
  chargesPersonnel:   [{ prefixes:['641'], label:'Rémunérations du personnel', sign:1 }, { prefixes:['642'], label:'Rémunérations des dirigeants', sign:1 }, { prefixes:['645'], label:'Charges de Sécurité Sociale', sign:1 }, { prefixes:['646'], label:'Cotisations aux caisses de retraite', sign:1 }, { prefixes:['647'], label:'Autres charges sociales', sign:1 }, { prefixes:['648'], label:'Autres charges de personnel', sign:1 }],
  dotations:          [{ prefixes:['681'], label:'Dotations amortissements corporels/incorporels', sign:1 }, { prefixes:['686'], label:'Dotations provisions financières', sign:1 }, { prefixes:['687'], label:'Dotations provisions exceptionnelles', sign:1 }],
  reprises:           [{ prefixes:['781'], label:'Reprises provisions d\'exploitation', sign:-1 }, { prefixes:['786'], label:'Reprises provisions financières', sign:-1 }, { prefixes:['787'], label:'Reprises provisions exceptionnelles', sign:-1 }],
  autresProduits:     [{ prefixes:['751'], label:'Redevances pour concessions', sign:-1 }, { prefixes:['752'], label:'Revenus des immeubles', sign:-1 }, { prefixes:['755'], label:'Quotes-parts de résultat sur opérations', sign:-1 }, { prefixes:['758'], label:'Produits divers de gestion courante', sign:-1 }],
  autresCharges:      [{ prefixes:['651'], label:'Redevances pour concessions', sign:1 }, { prefixes:['654'], label:'Pertes sur créances irrécouvrables', sign:1 }, { prefixes:['658'], label:'Charges diverses de gestion courante', sign:1 }],
  produitsFinanciers: [{ prefixes:['761'], label:'Produits de participations', sign:-1 }, { prefixes:['762'], label:'Produits des autres immobilisations financières', sign:-1 }, { prefixes:['764'], label:'Revenus des valeurs mobilières', sign:-1 }, { prefixes:['765'], label:'Escomptes obtenus', sign:-1 }, { prefixes:['766'], label:'Gains de change', sign:-1 }, { prefixes:['768'], label:'Autres produits financiers', sign:-1 }],
  chargesFinancieres: [{ prefixes:['661'], label:'Charges d\'intérêts', sign:1 }, { prefixes:['664'], label:'Pertes sur créances liées à des participations', sign:1 }, { prefixes:['665'], label:'Escomptes accordés', sign:1 }, { prefixes:['666'], label:'Pertes de change', sign:1 }, { prefixes:['668'], label:'Autres charges financières', sign:1 }],
  produitsExcep:      [{ prefixes:['771'], label:'Produits exceptionnels sur opérations de gestion', sign:-1 }, { prefixes:['775'], label:'Produits des cessions d\'éléments d\'actif', sign:-1 }, { prefixes:['777'], label:'Quote-part des subventions virée au résultat', sign:-1 }, { prefixes:['778'], label:'Autres produits exceptionnels', sign:-1 }],
  chargesExcep:       [{ prefixes:['671'], label:'Charges exceptionnelles sur opérations de gestion', sign:1 }, { prefixes:['675'], label:'Valeurs comptables des éléments d\'actif cédés', sign:1 }, { prefixes:['678'], label:'Autres charges exceptionnelles', sign:1 }],
  participation:      [{ prefixes:['691'], label:'Participation des salariés', sign:1 }],
  is:                 [{ prefixes:['695'], label:'Impôt sur les bénéfices', sign:1 }, { prefixes:['696'], label:'Contribution additionnelle', sign:1 }, { prefixes:['699'], label:'Produits — report en arrière des déficits', sign:-1 }],
}

function getSousComptes(lignes: LigneFEC[], groupeKey: string) {
  const groupe = PCG_GROUPES[groupeKey]
  if (!groupe) return []
  const result: { prefix: string; label: string; valeur: number; ecritures: LigneFEC[] }[] = []
  for (const g of groupe) {
    const matching = lignes.filter(l => g.prefixes.some(p => l.CompteNum.startsWith(p)))
    if (matching.length === 0) continue
    const valeur = matching.reduce((s, l) => s + (l.Debit - l.Credit) * g.sign, 0)
    if (Math.abs(valeur) < 0.5) continue
    const byCompte: Record<string, LigneFEC[]> = {}
    for (const l of matching) {
      if (!byCompte[l.CompteNum]) byCompte[l.CompteNum] = []
      byCompte[l.CompteNum].push(l)
    }
    for (const [num, ecritures] of Object.entries(byCompte)) {
      const v = ecritures.reduce((s, l) => s + (l.Debit - l.Credit) * g.sign, 0)
      if (Math.abs(v) < 0.5) continue
      const lib = ecritures[0]?.CompteLib || g.label
      result.push({ prefix: num, label: lib, valeur: v, ecritures })
    }
  }
  return result.sort((a, b) => a.prefix.localeCompare(b.prefix))
}

function formatCompte(num: string): string {
  if (num.length >= 8) return num.slice(0, 8)
  return num.padEnd(8, '0')
}

function solde(lignes: LigneFEC[], prefixes: string[], sign: 1 | -1 = 1): number {
  let t = 0
  for (const l of lignes) for (const p of prefixes) if (l.CompteNum.startsWith(p)) { t += l.Debit - l.Credit; break }
  return t * sign
}

function calculerSIG(lignes: LigneFEC[]) {
  const venteMarchandises  = -solde(lignes, ['707'], -1)
  const coutMarchandises   =  solde(lignes, ['607', '6037'])
  const margeCommerciale   = venteMarchandises - coutMarchandises
  const prodVendue         = -solde(lignes, ['701','702','703','704','705','706','708'], -1)
  const prodStockee        = -solde(lignes, ['713'], -1)
  const prodImmobilisee    = -solde(lignes, ['72'], -1)
  const productionExercice = prodVendue + prodStockee + prodImmobilisee
  const consommationsExt   = solde(lignes, ['601','602','604','605','606','608','609','61','62'])
  const subventions        = -solde(lignes, ['74'], -1)
  const valeurAjoutee      = margeCommerciale + productionExercice - consommationsExt + subventions
  const impotsTaxes        = solde(lignes, ['63'])
  const chargesPersonnel   = solde(lignes, ['64'])
  const ebe                = valeurAjoutee - impotsTaxes - chargesPersonnel
  const dotations          = solde(lignes, ['681','686','687'])
  const reprises           = -solde(lignes, ['781','786','787'], -1)
  const autresProduits     = -solde(lignes, ['75'], -1)
  const autresCharges      = solde(lignes, ['65'])
  const rex                = ebe - dotations + reprises + autresProduits - autresCharges
  const produitsFinanciers = -solde(lignes, ['76'], -1)
  const chargesFinancieres = solde(lignes, ['66'])
  const resultatFinancier  = produitsFinanciers - chargesFinancieres
  const rcai               = rex + resultatFinancier
  const produitsExcep      = -solde(lignes, ['77'], -1)
  const chargesExcep       = solde(lignes, ['67'])
  const resultatExcep      = produitsExcep - chargesExcep
  const participation      = solde(lignes, ['691'])
  const is                 = solde(lignes, ['695','696','697','698','699'])
  const resultatNet        = rcai + resultatExcep - participation - is
  const ca                 = prodVendue + venteMarchandises
  return {
    venteMarchandises, coutMarchandises, margeCommerciale,
    prodVendue, prodStockee, prodImmobilisee, productionExercice,
    consommationsExt, subventions, valeurAjoutee,
    impotsTaxes, chargesPersonnel, ebe,
    dotations, reprises, autresProduits, autresCharges, rex,
    produitsFinanciers, chargesFinancieres, resultatFinancier, rcai,
    produitsExcep, chargesExcep, resultatExcep,
    participation, is, resultatNet,
    ca, mb: margeCommerciale,
    tauxMb: ca > 0 ? margeCommerciale/ca*100 : 0,
    tauxEbe: ca > 0 ? ebe/ca*100 : 0,
    tauxRex: ca > 0 ? rex/ca*100 : 0,
    tauxRnet: ca > 0 ? resultatNet/ca*100 : 0,
    tauxPers: ca > 0 ? chargesPersonnel/ca*100 : 0,
    achats: coutMarchandises + consommationsExt,
    ext: consommationsExt, imp63: impotsTaxes, pers64: chargesPersonnel,
    dot68: dotations, fin66: chargesFinancieres, fin76: produitsFinanciers,
    exc67: chargesExcep, exc77: produitsExcep, is695: is,
    rfin: resultatFinancier, rnet: resultatNet,
  }
}

interface PanelData { compte: string; label: string; valeur: number; ecritures: LigneFEC[] }

// ── Side panel — inchangé ────────────────────────────────────────────────────
function SidePanel({ data, onClose }: { data: PanelData; onClose: () => void }) {
  const fmtDate = (d: string) => {
    const iso = toIso(d)
    if (!iso) return d
    return iso.slice(8,10) + '/' + iso.slice(5,7) + '/' + iso.slice(0,4)
  }
  return (
    <div style={{ width: 300, flexShrink: 0, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 120px)', position: 'sticky', top: 24 }}>
      <div style={{ background: '#1A1A1A', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#B8A98A', marginBottom: 2, fontFamily: 'monospace' }}>{formatCompte(data.compte)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, maxWidth: 220 }}>{data.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: data.valeur >= 0 ? '#fff' : '#D85A30' }}>{fmt(Math.abs(data.valeur))}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, padding: 2 }}>×</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {data.ecritures.map((e, i) => {
          const montant = e.Debit - e.Credit
          return (
            <div key={i} style={{ padding: '9px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, color: '#8C9BAB', marginBottom: 2 }}>{fmtDate(e.EcritureDate)}</div>
              <div style={{ fontSize: 12, color: '#1A1A1A', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.EcritureLib || '—'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#8C9BAB' }}>{e.PieceRef || '—'}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: montant > 0 ? '#1D9E75' : '#D85A30' }}>
                  {montant > 0 ? '+' : ''}{fmt(montant)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '9px 14px', borderTop: '0.5px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.02)' }}>
        <span style={{ fontSize: 11, color: '#8C9BAB' }}>{data.ecritures.length} écriture{data.ecritures.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

// ── Ligne de déduction entre deux SigRow ────────────────────────────────────
function DedLine({
  label, value, groupeKey, lignes, openDed, setOpenDed, panelData, setPanelData
}: {
  label: string; value: number; groupeKey?: string
  lignes: LigneFEC[]; openDed: string | null; setOpenDed: (k: string | null) => void
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
}) {
  const isOpen = openDed === groupeKey
  const sousComptes = useMemo(() => (isOpen && groupeKey) ? getSousComptes(lignes, groupeKey) : [], [isOpen, lignes, groupeKey])
  const hasDetail = groupeKey ? getSousComptes(lignes, groupeKey).length > 0 : false
  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1

  return (
    <>
      <div
        onClick={() => groupeKey && setOpenDed(isOpen ? null : groupeKey)}
        style={{ display: 'flex', alignItems: 'center', padding: '5px 14px 5px 28px', borderTop: '0.5px solid rgba(0,0,0,0.04)', background: 'rgba(0,0,0,0.015)', cursor: hasDetail ? 'pointer' : 'default', gap: 6 }}
      >
        <span style={{ fontSize: 11, color: '#B8A98A' }}>↳</span>
        <span style={{ fontSize: 11, color: '#8C9BAB', flex: 1 }}>{value < 0 ? '+' : '−'} {label}</span>
        {hasDetail && (
          <span style={{ fontSize: 9, color: '#B8A98A', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', marginRight: 8 }}>▶</span>
        )}
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8C9BAB' }}>{fmt(Math.abs(value))}</span>
      </div>

      {isOpen && sousComptes.length > 0 && (
        <div style={{ margin: '2px 8px 4px 20px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.06)', borderRadius: 8, overflow: 'hidden' }}>
          {sousComptes.map((sc, j) => {
            const pctBar = Math.abs(sc.valeur) / maxVal * 100
            const active = panelData?.compte === sc.prefix
            return (
              <div key={j}
                onClick={() => setPanelData(active ? null : { compte: sc.prefix, label: sc.label, valeur: sc.valeur, ecritures: sc.ecritures })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: j < sousComptes.length-1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', cursor: 'pointer', background: active ? 'rgba(184,169,138,0.08)' : 'transparent' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#B8A98A', minWidth: 70, fontFamily: 'monospace' }}>{formatCompte(sc.prefix)}</span>
                <span style={{ flex: 1, fontSize: 12, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.label}</span>
                <div style={{ width: 50, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, flexShrink: 0 }}>
                  <div style={{ height: '100%', width: `${pctBar}%`, background: sc.valeur >= 0 ? '#D85A30' : '#1D9E75', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: sc.valeur >= 0 ? '#D85A30' : '#1D9E75', minWidth: 80, textAlign: 'right' }}>{fmt(Math.abs(sc.valeur))}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── SigRow — nouvelle présentation N / N-1 en colonnes ───────────────────────
function SigRow({
  icon, label, value, pct, color, highlight, explain,
  deductions, lignes, groupeKey, panelData, setPanelData,
  lignesN1, caN1, openDed, setOpenDed
}: {
  icon: string; label: string; value: number; pct?: number; color?: string
  highlight?: boolean; explain: string
  deductions?: { label: string; value: number; groupeKey?: string }[]
  lignes: LigneFEC[]; groupeKey?: string
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
  lignesN1?: LigneFEC[]; caN1?: number
  openDed: string | null; setOpenDed: (k: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const sousComptes = useMemo(() => groupeKey ? getSousComptes(lignes, groupeKey) : [], [lignes, groupeKey])
  const hasDetail = sousComptes.length > 0

  // Valeur N-1
  const valN1 = (lignesN1 && lignesN1.length > 0 && groupeKey)
    ? getSousComptes(lignesN1, groupeKey).reduce((s, sc) => s + sc.valeur, 0)
    : null
  const pctN1 = (valN1 !== null && caN1 && caN1 > 0) ? valN1 / caN1 * 100 : null
  const variation = (valN1 !== null && valN1 !== 0) ? ((value - valN1) / Math.abs(valN1)) * 100 : null

  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1
  const c = color || (highlight ? '#B8A98A' : '#8C9BAB')
  const bg = highlight ? '#1A1A1A' : '#fff'
  const textColor = highlight ? '#fff' : '#1A1A1A'
  const mutedColor = highlight ? 'rgba(255,255,255,0.45)' : '#8C9BAB'
  const n1Color = highlight ? 'rgba(255,255,255,0.35)' : '#8C9BAB'
  const n1PctColor = highlight ? 'rgba(255,255,255,0.22)' : '#B4B2A9'

  // Colonnes : icon(32) | label+valeur(flex) | N(120) | N-1(120) | évolution(96) | chevron(20)
  const gridCols = '32px 1fr 120px 120px 96px 20px'

  return (
    <>
      {/* Déductions au-dessus de la ligne */}
      {deductions?.map((d, i) => (
        <DedLine
          key={i}
          label={d.label}
          value={d.value}
          groupeKey={d.groupeKey}
          lignes={lignes}
          openDed={openDed}
          setOpenDed={setOpenDed}
          panelData={panelData}
          setPanelData={setPanelData}
        />
      ))}

      {/* Ligne principale */}
      <div
        onClick={() => hasDetail && setOpen(o => !o)}
        style={{
          display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center',
          background: bg,
          border: `0.5px solid ${highlight ? '#1A1A1A' : 'rgba(0,0,0,0.06)'}`,
          borderLeft: `3px solid ${c}`,
          borderRadius: '0 10px 10px 0',
          padding: '10px 14px 10px 10px',
          marginBottom: 2,
          cursor: hasDetail ? 'pointer' : 'default',
          transition: 'background 0.15s',
        }}
      >
        {/* Icône */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
          {icon}
        </div>

        {/* Label + valeur principale (colonne gauche) */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: highlight ? '#fff' : (color || textColor), lineHeight: 1 }}>
            {fmt(value)}
          </div>
          {pct !== undefined && (
            <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>{fmtP(pct)} du CA</div>
          )}
        </div>

        {/* Colonne N */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? (color || '#B8A98A') : (color || '#1A1A1A') }}>
            {fmt(value)}
          </div>
          {pct !== undefined && (
            <div style={{ fontSize: 10, color: mutedColor, marginTop: 1 }}>{fmtP(pct)}</div>
          )}
        </div>

        {/* Colonne N-1 */}
        <div style={{ textAlign: 'right' }}>
          {valN1 !== null ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, color: n1Color }}>{fmt(valN1)}</div>
              {pctN1 !== null && (
                <div style={{ fontSize: 10, color: n1PctColor, marginTop: 1 }}>{fmtP(pctN1)}</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: n1Color }}>—</div>
          )}
        </div>

        {/* Colonne évolution */}
        <div style={{ textAlign: 'center' }}>
          {variation !== null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, fontWeight: 600,
              color: variation >= 0 ? '#0F6E56' : '#993C1D',
              background: variation >= 0 ? '#E1F5EE' : '#FAECE7',
              padding: '3px 7px', borderRadius: 20, whiteSpace: 'nowrap',
            }}>
              {variation >= 0 ? '▲' : '▼'} {Math.abs(Math.round(variation * 10) / 10).toFixed(1)} %
            </span>
          )}
        </div>

        {/* Chevron drill-down */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {hasDetail && (
            <span style={{ fontSize: 10, color: highlight ? 'rgba(255,255,255,0.35)' : '#8C9BAB', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          )}
        </div>
      </div>

      {/* Drill-down comptes N */}
      {open && sousComptes.length > 0 && (
        <div style={{ margin: '0 0 4px 0', background: '#fff', border: '0.5px solid rgba(0,0,0,0.06)', borderRadius: 8, overflow: 'hidden' }}>
          {sousComptes.map((sc, i) => {
            const pctBar = Math.abs(sc.valeur) / maxVal * 100
            const active = panelData?.compte === sc.prefix
            return (
              <div key={i}
                onClick={() => setPanelData(active ? null : { compte: sc.prefix, label: sc.label, valeur: sc.valeur, ecritures: sc.ecritures })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: i < sousComptes.length-1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', cursor: 'pointer', background: active ? 'rgba(184,169,138,0.08)' : 'transparent', transition: 'background 0.1s' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#B8A98A', minWidth: 70, fontFamily: 'monospace' }}>{formatCompte(sc.prefix)}</span>
                <span style={{ flex: 1, fontSize: 12, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.label}</span>
                <div style={{ width: 60, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, flexShrink: 0 }}>
                  <div style={{ height: '100%', width: `${pctBar}%`, background: color || '#B8A98A', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', minWidth: 90, textAlign: 'right' }}>{fmt(Math.abs(sc.valeur))}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── En-tête des colonnes ─────────────────────────────────────────────────────
function ColHeader({ anneeActive, anneeN1 }: { anneeActive: number; anneeN1: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '32px 1fr 120px 120px 96px 20px',
      padding: '0 14px 8px 10px',
      marginBottom: 4,
    }}>
      <div />
      <div style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Indicateur</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.09em', textAlign: 'right' }}>N — {anneeActive}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.09em', textAlign: 'right' }}>N-1 — {anneeN1}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.09em', textAlign: 'center' }}>Évolution</div>
      <div />
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function ProfitabilityPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [panelData, setPanelData] = useState<PanelData | null>(null)
  const [openDed, setOpenDed] = useState<string | null>(null)

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/'; return }
      const { data } = await sb.from('fec_exercices').select('annee, ecritures').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const map: Record<number,any> = {}
        for (const row of data) map[row.annee] = { annee: row.annee, lignes: row.ecritures as LigneFEC[] }
        setExercices(map)
        if (typeof window === 'undefined' || !localStorage.getItem('alvio-period')) setAnneeActive(data[0].annee)
      }
      setLoading(false)
    })
  }, [])

  const lignesActives: LigneFEC[] = useMemo(() => {
    if (periodeTab === 'perso' && dateDebut && dateFin) {
      const merged: LigneFEC[] = []
      for (const a of Object.keys(exercices).map(Number).sort((x,y) => x-y)) {
        const ex = exercices[a]; if (!ex) continue
        const dates = ex.lignes.map((l:LigneFEC) => toIso(l.EcritureDate)).filter(Boolean).sort()
        if (dates.length && toIso(dates[dates.length-1]) >= dateDebut && toIso(dates[0]) <= dateFin)
          merged.push(...filtrerLignes(ex.lignes, 'perso', dateDebut, dateFin))
      }
      if (merged.length > 0) return merged
    }
    return exercices[anneeActive]?.lignes ?? []
  }, [exercices, anneeActive, periodeTab, dateDebut, dateFin])

  const lignesN1: LigneFEC[] = (() => {
    if (periodeTab === 'perso' && dateDebut && dateFin) {
      const dN1 = decalerAnMoins1(dateDebut)
      const fN1 = decalerAnMoins1(dateFin)
      const merged: LigneFEC[] = []
      for (const a of Object.keys(exercices).map(Number).sort((x,y) => x-y)) {
        const ex = exercices[a]; if (!ex) continue
        const dates = ex.lignes.map((l:LigneFEC) => toIso(l.EcritureDate)).filter(Boolean).sort()
        if (dates.length && toIso(dates[dates.length-1]) >= dN1 && toIso(dates[0]) <= fN1)
          merged.push(...filtrerLignes(ex.lignes, 'perso', dN1, fN1))
      }
      if (merged.length > 0) return merged
    }
    return exercices[anneeActive - 1]?.lignes ?? []
  })()

  const caN1 = lignesN1.length > 0 ? (() => {
    const ventes = lignesN1.filter(l => ['701','702','703','704','705','706','707','708'].some(p => l.CompteNum.startsWith(p)))
    return Math.abs(ventes.reduce((s,l) => s + (l.Debit - l.Credit), 0))
  })() : 0

  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)
  const sig = useMemo(() => lignesActives.length > 0 ? calculerSIG(lignesActives) : null, [lignesActives])
  const sigN1 = useMemo(() => lignesN1.length > 0 ? calculerSIG(lignesN1) : null, [lignesN1])
  const show = (v: number) => Math.abs(v) > 0.5

  const rowProps = {
    lignes: lignesActives,
    panelData, setPanelData,
    lignesN1, caN1,
    openDed, setOpenDed,
  }

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>

        {/* ── Topbar — inchangée ── */}
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0, position:'sticky' as const, top:0, zIndex:10 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Rentabilité</span>
          {sig && (
            <PeriodSelector
              annees={anneesDisponibles}
              anneeActive={anneeActive} setAnneeActive={setAnneeActive}
              periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
              dateDebut={dateDebut} setDateDebut={setDateDebut}
              dateFin={dateFin} setDateFin={setDateFin}
              anneeN1={anneeN1} setAnneeN1={setAnneeN1}
              dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1}
              dateFinN1={dateFinN1} setDateFinN1={setDateFinN1}
            />
          )}
        </div>

        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!sig ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ display:'flex', gap:16, alignItems:'flex-start', maxWidth:1200 }}>
              <div style={{ flex:1, minWidth:0 }}>

                <AlvioInsight payload={{
                  page:'profitability', annee:anneeActive,
                  periode: periodeTab==='perso'&&dateDebut&&dateFin ? `${dateDebut} → ${dateFin}` : undefined,
                  indicateurs:{ ca:sig.ca, mb:sig.mb, ebe:sig.ebe, rex:sig.rex, rnet:sig.rnet, tauxMb:sig.tauxMb, tauxEbe:sig.tauxEbe, tauxRex:sig.tauxRex, tauxRnet:sig.tauxRnet, tauxPers:sig.tauxPers, pers64:sig.pers64 }
                }} />

                <div style={{ fontSize:11, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                  Soldes intermédiaires de gestion
                </div>

                <ColHeader anneeActive={anneeActive} anneeN1={anneeActive - 1} />

                <SigRow icon="💰" label="Chiffre d'affaires" value={sig.ca} pct={100} color="#B8A98A" explain="Total de vos ventes hors taxes" groupeKey="prodVendue" {...rowProps} />

                {show(sig.venteMarchandises) && <SigRow icon="🏪" label="Ventes de marchandises" value={sig.venteMarchandises} pct={sig.ca>0?sig.venteMarchandises/sig.ca*100:0} color="#B8A98A" explain="Revente de marchandises" groupeKey="venteMarchandises" {...rowProps} />}

                {show(sig.margeCommerciale) && (
                  <SigRow icon="🏪" label="Marge commerciale" value={sig.margeCommerciale} pct={sig.ca>0?sig.margeCommerciale/sig.ca*100:0} color="#B8A98A" explain="Ventes − coût d'achat marchandises" groupeKey="venteMarchandises"
                    deductions={show(sig.coutMarchandises) ? [{ label:"Coût d'achat des marchandises", value:sig.coutMarchandises, groupeKey:'coutMarchandises' }] : []}
                    {...rowProps}
                  />
                )}

                {(show(sig.prodStockee)||show(sig.prodImmobilisee)) && (
                  <SigRow icon="🏭" label="Production de l'exercice" value={sig.productionExercice} pct={sig.ca>0?sig.productionExercice/sig.ca*100:0} explain="CA + stockage + immobilisation" groupeKey="prodVendue"
                    deductions={[
                      ...(show(sig.prodStockee) ? [{ label:'Production stockée', value:-sig.prodStockee, groupeKey:'prodStockee' }] : []),
                      ...(show(sig.prodImmobilisee) ? [{ label:'Production immobilisée', value:-sig.prodImmobilisee, groupeKey:'prodImmobilisee' }] : []),
                    ]}
                    {...rowProps}
                  />
                )}

                <SigRow icon="⚙️" label="Valeur ajoutée" value={sig.valeurAjoutee} pct={sig.ca>0?sig.valeurAjoutee/sig.ca*100:0} explain="Richesse créée par l'entreprise" groupeKey="consommationsExt"
                  deductions={[
                    { label:'Consommations externes', value:sig.consommationsExt, groupeKey:'consommationsExt' },
                    ...(show(sig.subventions) ? [{ label:"Subventions d'exploitation", value:-sig.subventions, groupeKey:'subventions' }] : []),
                  ]}
                  {...rowProps}
                />

                <SigRow icon="⚡" label="EBE — Excédent Brut d'Exploitation" value={sig.ebe} pct={sig.tauxEbe} color={sig.tauxEbe>=10?'#1D9E75':'#D85A30'} highlight={true} explain="Baromètre de rentabilité opérationnelle" groupeKey="chargesPersonnel"
                  deductions={[
                    ...(show(sig.impotsTaxes) ? [{ label:'Impôts & taxes', value:sig.impotsTaxes, groupeKey:'impotsTaxes' }] : []),
                    { label:'Charges de personnel', value:sig.chargesPersonnel, groupeKey:'chargesPersonnel' },
                  ]}
                  {...rowProps}
                />

                <SigRow icon="🎯" label="Résultat d'exploitation" value={sig.rex} pct={sig.tauxRex} color={sig.rex>=0?'#1D9E75':'#D85A30'} explain="Rentabilité du cœur de métier" groupeKey="dotations"
                  deductions={[
                    ...(show(sig.dotations) ? [{ label:'Dotations aux amortissements', value:sig.dotations, groupeKey:'dotations' }] : []),
                    ...(show(sig.reprises) ? [{ label:'Reprises sur provisions', value:-sig.reprises, groupeKey:'reprises' }] : []),
                    ...(show(sig.autresProduits) ? [{ label:'Autres produits (75)', value:-sig.autresProduits, groupeKey:'autresProduits' }] : []),
                    ...(show(sig.autresCharges) ? [{ label:'Autres charges (65)', value:sig.autresCharges, groupeKey:'autresCharges' }] : []),
                  ]}
                  {...rowProps}
                />

                {show(sig.resultatFinancier) && (
                  <SigRow icon="🏦" label="Résultat courant avant impôts" value={sig.rcai} pct={sig.ca>0?sig.rcai/sig.ca*100:0} color={sig.rcai>=0?'#1D9E75':'#D85A30'} explain="REX + résultat financier" groupeKey="produitsFinanciers"
                    deductions={[
                      ...(show(sig.produitsFinanciers) ? [{ label:'Produits financiers', value:-sig.produitsFinanciers, groupeKey:'produitsFinanciers' }] : []),
                      ...(show(sig.chargesFinancieres) ? [{ label:'Charges financières', value:sig.chargesFinancieres, groupeKey:'chargesFinancieres' }] : []),
                    ]}
                    {...rowProps}
                  />
                )}

                {show(sig.resultatExcep) && (
                  <SigRow icon="⚠️" label="Résultat exceptionnel" value={sig.resultatExcep} pct={sig.ca>0?sig.resultatExcep/sig.ca*100:0} color={sig.resultatExcep>=0?'#1D9E75':'#D85A30'} explain="Éléments ponctuels hors activité" groupeKey="produitsExcep"
                    deductions={[
                      ...(show(sig.produitsExcep) ? [{ label:'Produits exceptionnels', value:-sig.produitsExcep, groupeKey:'produitsExcep' }] : []),
                      ...(show(sig.chargesExcep) ? [{ label:'Charges exceptionnelles', value:sig.chargesExcep, groupeKey:'chargesExcep' }] : []),
                    ]}
                    {...rowProps}
                  />
                )}

                <SigRow icon="✅" label="Résultat net" value={sig.rnet} pct={sig.tauxRnet} color={sig.rnet>=0?'#1D9E75':'#D85A30'} explain="Ce que vous gardez après tout" groupeKey="is"
                  deductions={[
                    ...(show(sig.participation) ? [{ label:'Participation des salariés', value:sig.participation, groupeKey:'participation' }] : []),
                    ...(show(sig.is) ? [{ label:'Impôt sur les sociétés', value:sig.is, groupeKey:'is' }] : []),
                  ]}
                  {...rowProps}
                />

              </div>

              {panelData && <SidePanel data={panelData} onClose={() => setPanelData(null)} />}
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
