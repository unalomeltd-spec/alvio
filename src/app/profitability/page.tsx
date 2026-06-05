'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePeriod } from '@/hooks/usePeriod'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import PeriodSelector from '@/components/PeriodSelector'
import AlvioInsight from '@/components/AlvioInsight'
import { filtrerLignes } from '@/hooks/useFEC'
import { usePCG, getSousComptes, soldePCG } from '@/hooks/usePCG'
import type { LigneFEC } from '@/hooks/useFEC'
import type { PCGGroupe, PCGIndex } from '@/hooks/usePCG'

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

function formatCompte(num: string): string {
  if (num.length >= 8) return num.slice(0, 8)
  return num.padEnd(8, '0')
}

// getSousComptes et soldePCG importés depuis usePCG — sans double comptage

function calculerSIG(lignes: LigneFEC[], pcg: PCGGroupe, index: PCGIndex) {
  const s = (key: string) => soldePCG(lignes, key, pcg, index)
  const ventesMarchandises    = s('ventesMarchandises')
  const coutMarchandises      = s('coutMarchandises')
  const margeCommerciale      = ventesMarchandises - coutMarchandises
  const productionVendue      = s('productionVendue')
  const productionStockee     = s('productionStockee')
  const productionImmobilisee = s('productionImmobilisee')
  const productionExercice    = productionVendue + productionStockee + productionImmobilisee
  const consommationsExt      = s('consommationsIntermediaires')
  const subventions           = s('subventions')
  const valeurAjoutee         = margeCommerciale + productionExercice - consommationsExt
  const impotsTaxes           = s('impotsTaxes')
  const chargesPersonnel      = s('chargesPersonnel')
  const ebe                   = valeurAjoutee + subventions - impotsTaxes - chargesPersonnel
  const dotations             = s('dotations')
  const reprises              = s('reprises')
  const autresProduits        = s('autresProduits')
  const autresCharges         = s('autresCharges')
  const rex                   = ebe - dotations + reprises + autresProduits - autresCharges
  const produitsFinanciers    = s('produitsFinanciers')
  const chargesFinancieres    = s('chargesFinancieres')
  const resultatFinancier     = produitsFinanciers - chargesFinancieres
  const rcai                  = rex + resultatFinancier
  const produitsExcep         = s('produitsExceptionnels')
  const chargesExcep          = s('chargesExceptionnelles')
  const resultatExcep         = produitsExcep - chargesExcep
  const participation         = s('participation')
  const is                    = s('is')
  const resultatNet           = rcai + resultatExcep - participation - is
  const ca                    = productionVendue + ventesMarchandises
  return {
    ventesMarchandises, coutMarchandises, margeCommerciale,
    productionVendue, productionStockee, productionImmobilisee, productionExercice,
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
    rnet: resultatNet,
  }
}

interface PanelData { compte: string; label: string; valeur: number; ecritures: LigneFEC[] }

function SidePanel({ data, onClose }: { data: PanelData; onClose: () => void }) {
  const fmtDate = (d: string) => {
    const iso = toIso(d); if (!iso) return d
    return iso.slice(8,10) + '/' + iso.slice(5,7) + '/' + iso.slice(0,4)
  }
  return (
    <div style={{ width:300, flexShrink:0, position:'fixed' as const, top:80, right:24, zIndex:100, background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 120px)' }}>
      <div style={{ background:'#1A1A1A', padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#B8A98A', marginBottom:2, fontFamily:'monospace' }}>{formatCompte(data.compte)}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8, maxWidth:220 }}>{data.label}</div>
            <div style={{ fontSize:22, fontWeight:600, color: data.valeur >= 0 ? '#fff' : '#D85A30' }}>{fmt(Math.abs(data.valeur))}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:18, padding:2 }}>×</button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {data.ecritures.map((e, i) => {
          const montant = e.Debit - e.Credit
          return (
            <div key={i} style={{ padding:'9px 14px', borderBottom:'0.5px solid rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize:10, color:'#8C9BAB', marginBottom:2 }}>{fmtDate(e.EcritureDate)}</div>
              <div style={{ fontSize:12, color:'#1A1A1A', marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.EcritureLib || '—'}</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:10, color:'#8C9BAB' }}>{e.PieceRef || '—'}</span>
                <span style={{ fontSize:12, fontWeight:500, color: montant > 0 ? '#1D9E75' : '#D85A30' }}>{montant > 0 ? '+' : ''}{fmt(montant)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ padding:'9px 14px', borderTop:'0.5px solid rgba(0,0,0,0.06)', background:'rgba(0,0,0,0.02)' }}>
        <span style={{ fontSize:11, color:'#8C9BAB' }}>{data.ecritures.length} écriture{data.ecritures.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

function DedLine({ label, value, groupeKey, lignes, openDed, setOpenDed, panelData, setPanelData, pcg, index }: {
  label: string; value: number; groupeKey?: string
  lignes: LigneFEC[]; openDed: string | null; setOpenDed: (k: string | null) => void
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
  pcg: PCGGroupe; index: PCGIndex
}) {
  const isOpen = openDed === groupeKey
  const sousComptes = useMemo(() => (isOpen && groupeKey) ? getSousComptes(lignes, groupeKey, pcg, index) : [], [isOpen, lignes, groupeKey, pcg, index])
  const hasDetail = groupeKey ? getSousComptes(lignes, groupeKey, pcg, index).length > 0 : false
  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1
  return (
    <>
      <div onClick={() => groupeKey && setOpenDed(isOpen ? null : groupeKey)}
        style={{ display:'flex', alignItems:'center', padding:'5px 14px 5px 28px', borderTop:'0.5px solid rgba(0,0,0,0.04)', background:'rgba(0,0,0,0.015)', cursor: hasDetail ? 'pointer' : 'default', gap:6 }}>
        <span style={{ fontSize:11, color:'#B8A98A' }}>↳</span>
        <span style={{ fontSize:11, color:'#8C9BAB', flex:1 }}>{value < 0 ? '+' : '−'} {label}</span>
        {hasDetail && <span style={{ fontSize:9, color:'#B8A98A', transition:'transform 0.2s', display:'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', marginRight:8 }}>▶</span>}
        <span style={{ fontSize:11, fontWeight:500, color:'#8C9BAB' }}>{fmt(Math.abs(value))}</span>
      </div>
      {isOpen && sousComptes.length > 0 && (
        <div style={{ margin:'2px 8px 4px 20px', background:'#fff', border:'0.5px solid rgba(0,0,0,0.06)', borderRadius:8, overflow:'hidden' }}>
          {sousComptes.map((sc, j) => {
            const pctBar = Math.abs(sc.valeur) / maxVal * 100
            const active = panelData?.compte === sc.prefix
            return (
              <div key={j} onClick={() => setPanelData(active ? null : { compte: sc.prefix, label: sc.label, valeur: sc.valeur, ecritures: sc.ecritures })}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', borderBottom: j < sousComptes.length-1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', cursor:'pointer', background: active ? 'rgba(184,169,138,0.08)' : 'transparent' }}>
                <span style={{ fontSize:11, fontWeight:600, color:'#B8A98A', minWidth:70, fontFamily:'monospace' }}>{formatCompte(sc.prefix)}</span>
                <span style={{ flex:1, fontSize:12, color:'#1A1A1A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sc.label}</span>
                <div style={{ width:50, height:4, background:'rgba(0,0,0,0.06)', borderRadius:2, flexShrink:0 }}>
                  <div style={{ height:'100%', width:`${pctBar}%`, background: sc.valeur >= 0 ? '#D85A30' : '#1D9E75', borderRadius:2 }} />
                </div>
                <span style={{ fontSize:12, fontWeight:500, color: sc.valeur >= 0 ? '#D85A30' : '#1D9E75', minWidth:80, textAlign:'right' }}>{fmt(Math.abs(sc.valeur))}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function SigRow({ icon, label, value, pct, color, highlight, explain, deductions, lignes, groupeKey, panelData, setPanelData, lignesN1, caN1, openDed, setOpenDed, pcg, index }: {
  icon: string; label: string; value: number; pct?: number; color?: string
  highlight?: boolean; explain: string
  deductions?: { label: string; value: number; groupeKey?: string }[]
  lignes: LigneFEC[]; groupeKey?: string
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
  lignesN1?: LigneFEC[]; caN1?: number
  openDed: string | null; setOpenDed: (k: string | null) => void
  pcg: PCGGroupe; index: PCGIndex
}) {
  const [open, setOpen] = useState(false)
  const sousComptes = useMemo(() => groupeKey ? getSousComptes(lignes, groupeKey, pcg, index) : [], [lignes, groupeKey, pcg, index])
  const hasDetail = sousComptes.length > 0
  const valN1 = (lignesN1 && lignesN1.length > 0 && groupeKey) ? getSousComptes(lignesN1, groupeKey, pcg, index).reduce((s, sc) => s + sc.valeur, 0) : null
  const pctN1 = (valN1 !== null && caN1 && caN1 > 0) ? valN1 / caN1 * 100 : null
  const variation = (valN1 !== null && valN1 !== 0) ? ((value - valN1) / Math.abs(valN1)) * 100 : null
  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1
  const c = color || (highlight ? '#B8A98A' : '#8C9BAB')
  const bg = highlight ? '#1A1A1A' : '#fff'
  const textColor = highlight ? '#fff' : '#1A1A1A'
  const mutedColor = highlight ? 'rgba(255,255,255,0.45)' : '#8C9BAB'
  const n1Color = highlight ? 'rgba(255,255,255,0.35)' : '#8C9BAB'
  const n1PctColor = highlight ? 'rgba(255,255,255,0.22)' : '#B4B2A9'
  const gridCols = '32px 1fr 120px 120px 96px 20px'
  return (
    <>
      {deductions?.map((d, i) => (
        <DedLine key={i} label={d.label} value={d.value} groupeKey={d.groupeKey}
          lignes={lignes} openDed={openDed} setOpenDed={setOpenDed}
          panelData={panelData} setPanelData={setPanelData} pcg={pcg} index={index} />
      ))}
      <div onClick={() => hasDetail && setOpen(o => !o)}
        style={{ display:'grid', gridTemplateColumns:gridCols, alignItems:'center', background:bg, border:`0.5px solid ${highlight ? '#1A1A1A' : 'rgba(0,0,0,0.06)'}`, borderLeft:`3px solid ${c}`, borderRadius:'0 10px 10px 0', padding:'10px 14px 10px 10px', marginBottom:2, cursor: hasDetail ? 'pointer' : 'default', transition:'background 0.15s' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
          {icon === '💰' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
          {icon === '🏪' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
          {icon === '🏭' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>}
          {icon === '⚙️' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}
          {icon === '⚡' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={highlight ? '#F2F3F5' : '#B8A98A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
          {icon === '🎯' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>}
          {icon === '🏦' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
          {icon === '⚠️' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          {icon === '✅' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:600, color:mutedColor, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
          <div style={{ fontSize:20, fontWeight:600, color: highlight ? '#fff' : (color || textColor), lineHeight:1 }}>{fmt(value)}</div>
          {pct !== undefined && <div style={{ fontSize:11, color:mutedColor, marginTop:2 }}>{fmtP(pct)} du CA</div>}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:13, fontWeight:600, color: highlight ? (color || '#B8A98A') : (color || '#1A1A1A') }}>{fmt(value)}</div>
          {pct !== undefined && <div style={{ fontSize:10, color:mutedColor, marginTop:1 }}>{fmtP(pct)}</div>}
        </div>
        <div style={{ textAlign:'right' }}>
          {valN1 !== null ? (
            <>
              <div style={{ fontSize:13, fontWeight:500, color:n1Color }}>{fmt(valN1)}</div>
              {pctN1 !== null && <div style={{ fontSize:10, color:n1PctColor, marginTop:1 }}>{fmtP(pctN1)}</div>}
            </>
          ) : <div style={{ fontSize:12, color:n1Color }}>—</div>}
        </div>
        <div style={{ textAlign:'center' }}>
          {variation !== null && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:600, color: variation >= 0 ? '#0F6E56' : '#993C1D', background: variation >= 0 ? '#E1F5EE' : '#FAECE7', padding:'3px 7px', borderRadius:20, whiteSpace:'nowrap' }}>
              {variation >= 0 ? '▲' : '▼'} {Math.abs(Math.round(variation * 10) / 10).toFixed(1)} %
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
          {hasDetail && <span style={{ fontSize:10, color: highlight ? 'rgba(255,255,255,0.35)' : '#8C9BAB', transition:'transform 0.2s', display:'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>}
        </div>
      </div>
      {open && sousComptes.length > 0 && (
        <div style={{ margin:'0 0 4px 0', background:'#fff', border:'0.5px solid rgba(0,0,0,0.06)', borderRadius:8, overflow:'hidden' }}>
          {sousComptes.map((sc, i) => {
            const pctBar = Math.abs(sc.valeur) / maxVal * 100
            const active = panelData?.compte === sc.prefix
            return (
              <div key={i} onClick={() => setPanelData(active ? null : { compte: sc.prefix, label: sc.label, valeur: sc.valeur, ecritures: sc.ecritures })}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderBottom: i < sousComptes.length-1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', cursor:'pointer', background: active ? 'rgba(184,169,138,0.08)' : 'transparent', transition:'background 0.1s' }}>
                <span style={{ fontSize:11, fontWeight:600, color:'#B8A98A', minWidth:70, fontFamily:'monospace' }}>{formatCompte(sc.prefix)}</span>
                <span style={{ flex:1, fontSize:12, color:'#1A1A1A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sc.label}</span>
                <div style={{ width:60, height:4, background:'rgba(0,0,0,0.06)', borderRadius:2, flexShrink:0 }}>
                  <div style={{ height:'100%', width:`${pctBar}%`, background: color || '#B8A98A', borderRadius:2 }} />
                </div>
                <span style={{ fontSize:12, fontWeight:500, color:'#1A1A1A', minWidth:90, textAlign:'right' }}>{fmt(Math.abs(sc.valeur))}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function ColHeader({ anneeActive, anneeN1 }: { anneeActive: number; anneeN1: number }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 120px 120px 96px 20px', padding:'0 14px 8px 10px', marginBottom:4 }}>
      <div /><div style={{ fontSize:9, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.09em' }}>Indicateur</div>
      <div style={{ fontSize:9, fontWeight:600, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.09em', textAlign:'right' }}>N — {anneeActive}</div>
      <div style={{ fontSize:9, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.09em', textAlign:'right' }}>N-1 — {anneeN1}</div>
      <div style={{ fontSize:9, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.09em', textAlign:'center' }}>Évolution</div>
      <div />
    </div>
  )
}

export default function ProfitabilityPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [typePcg, setTypePcg] = useState<'classique'|'asso'>('classique')
  const [panelData, setPanelData] = useState<PanelData | null>(null)
  const [openDed, setOpenDed] = useState<string | null>(null)
  const { mappings, pcgLoading } = usePCG(typePcg)

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/'; return }
      const { data } = await sb.from('fec_exercices').select('annee, ecritures, type_pcg').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const map: Record<number,any> = {}
        for (const row of data) map[row.annee] = { annee: row.annee, lignes: row.ecritures as LigneFEC[] }
        setExercices(map)
        if (typeof window === 'undefined' || !localStorage.getItem('alvio-period')) setAnneeActive(data[0].annee)
        setTypePcg((data[0].type_pcg as 'classique'|'asso') || 'classique')
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

  const lignesN1: LigneFEC[] = useMemo(() => {
    if (periodeTab === 'perso' && dateDebut && dateFin) {
      const dN1 = decalerAnMoins1(dateDebut); const fN1 = decalerAnMoins1(dateFin)
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
  }, [exercices, anneeActive, periodeTab, dateDebut, dateFin])

  const caN1 = useMemo(() => {
    if (!lignesN1.length) return 0
    return Math.abs(lignesN1.filter(l => ['701','702','703','704','705','706','707','708'].some(p => l.CompteNum.startsWith(p))).reduce((s,l) => s + (l.Debit - l.Credit), 0))
  }, [lignesN1])

  const pcg = mappings?.sig ?? {}
  const index = mappings?.sigIndex
  const hasPCG = Object.keys(pcg).length > 0 && !!index
  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)
  const sig = useMemo(() => (lignesActives.length > 0 && hasPCG) ? calculerSIG(lignesActives, pcg, index!) : null, [lignesActives, pcg, index])
  const sigN1 = useMemo(() => (lignesN1.length > 0 && hasPCG) ? calculerSIG(lignesN1, pcg, index!) : null, [lignesN1, pcg, index])
  const show = (v: number) => Math.abs(v) > 0.5

  const rowProps = { lignes: lignesActives, panelData, setPanelData, lignesN1, caN1, openDed, setOpenDed, pcg, index: index! }

  if (loading || pcgLoading) return (
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
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0, position:'sticky' as const, top:0, zIndex:10 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Rentabilité</span>
          {sig && <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive} periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} anneeN1={anneeN1} setAnneeN1={setAnneeN1} dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1} dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />}
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
                <AlvioInsight payload={{ page:'profitability', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ ca:sig.ca, mb:sig.mb, ebe:sig.ebe, rex:sig.rex, rnet:sig.rnet, tauxMb:sig.tauxMb, tauxEbe:sig.tauxEbe, tauxRex:sig.tauxRex, tauxRnet:sig.tauxRnet, tauxPers:sig.tauxPers, pers64:sig.chargesPersonnel } }} />
                <div style={{ fontSize:11, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Soldes intermédiaires de gestion</div>
                <ColHeader anneeActive={anneeActive} anneeN1={anneeActive - 1} />
                <SigRow icon="💰" label="Chiffre d'affaires" value={sig.ca} pct={100} color="#B8A98A" explain="Total de vos ventes hors taxes" groupeKey="productionVendue" {...rowProps} />
                {show(sig.ventesMarchandises) && <SigRow icon="🏪" label="Ventes de marchandises" value={sig.ventesMarchandises} pct={sig.ca>0?sig.ventesMarchandises/sig.ca*100:0} color="#B8A98A" explain="Revente de marchandises" groupeKey="ventesMarchandises" {...rowProps} />}
                {show(sig.margeCommerciale) && (
                  <SigRow icon="🏪" label="Marge commerciale" value={sig.margeCommerciale} pct={sig.ca>0?sig.margeCommerciale/sig.ca*100:0} color="#B8A98A" explain="Ventes − coût d'achat marchandises" groupeKey="coutMarchandises"
                    deductions={show(sig.coutMarchandises) ? [{ label:"Coût d'achat des marchandises", value:sig.coutMarchandises, groupeKey:'coutMarchandises' }] : []} {...rowProps} />
                )}
                {(show(sig.productionStockee)||show(sig.productionImmobilisee)) && (
                  <SigRow icon="🏭" label="Production de l'exercice" value={sig.productionExercice} pct={sig.ca>0?sig.productionExercice/sig.ca*100:0} explain="CA + stockage + immobilisation" groupeKey="productionVendue"
                    deductions={[
                      ...(show(sig.productionStockee) ? [{ label:'Production stockée', value:-sig.productionStockee, groupeKey:'productionStockee' }] : []),
                      ...(show(sig.productionImmobilisee) ? [{ label:'Production immobilisée', value:-sig.productionImmobilisee, groupeKey:'productionImmobilisee' }] : []),
                    ]} {...rowProps} />
                )}
                <SigRow icon="⚙️" label="Valeur ajoutée" value={sig.valeurAjoutee} pct={sig.ca>0?sig.valeurAjoutee/sig.ca*100:0} explain="Richesse créée par l'entreprise" groupeKey="consommationsIntermediaires"
                  deductions={[
                    { label:'Consommations externes', value:sig.consommationsExt, groupeKey:'consommationsIntermediaires' },
                    ...(show(sig.subventions) ? [{ label:"Subventions d'exploitation", value:-sig.subventions, groupeKey:'subventions' }] : []),
                  ]} {...rowProps} />
                <SigRow icon="⚡" label="EBE — Excédent Brut d'Exploitation" value={sig.ebe} pct={sig.tauxEbe} color={sig.tauxEbe>=10?'#1D9E75':'#D85A30'} highlight={true} explain="Baromètre de rentabilité opérationnelle" groupeKey="chargesPersonnel"
                  deductions={[
                    ...(show(sig.impotsTaxes) ? [{ label:'Impôts & taxes', value:sig.impotsTaxes, groupeKey:'impotsTaxes' }] : []),
                    { label:'Charges de personnel', value:sig.chargesPersonnel, groupeKey:'chargesPersonnel' },
                  ]} {...rowProps} />
                <SigRow icon="🎯" label="Résultat d'exploitation" value={sig.rex} pct={sig.tauxRex} color={sig.rex>=0?'#1D9E75':'#D85A30'} explain="Rentabilité du cœur de métier" groupeKey="dotations"
                  deductions={[
                    ...(show(sig.dotations) ? [{ label:'Dotations aux amortissements', value:sig.dotations, groupeKey:'dotations' }] : []),
                    ...(show(sig.reprises) ? [{ label:'Reprises sur provisions', value:-sig.reprises, groupeKey:'reprises' }] : []),
                    ...(show(sig.autresProduits) ? [{ label:'Autres produits (75)', value:-sig.autresProduits, groupeKey:'autresProduits' }] : []),
                    ...(show(sig.autresCharges) ? [{ label:'Autres charges (65)', value:sig.autresCharges, groupeKey:'autresCharges' }] : []),
                  ]} {...rowProps} />
                {show(sig.resultatFinancier) && (
                  <SigRow icon="🏦" label="Résultat courant avant impôts" value={sig.rcai} pct={sig.ca>0?sig.rcai/sig.ca*100:0} color={sig.rcai>=0?'#1D9E75':'#D85A30'} explain="REX + résultat financier" groupeKey="produitsFinanciers"
                    deductions={[
                      ...(show(sig.produitsFinanciers) ? [{ label:'Produits financiers', value:-sig.produitsFinanciers, groupeKey:'produitsFinanciers' }] : []),
                      ...(show(sig.chargesFinancieres) ? [{ label:'Charges financières', value:sig.chargesFinancieres, groupeKey:'chargesFinancieres' }] : []),
                    ]} {...rowProps} />
                )}
                {show(sig.resultatExcep) && (
                  <SigRow icon="⚠️" label="Résultat exceptionnel" value={sig.resultatExcep} pct={sig.ca>0?sig.resultatExcep/sig.ca*100:0} color={sig.resultatExcep>=0?'#1D9E75':'#D85A30'} explain="Éléments ponctuels hors activité" groupeKey="produitsExceptionnels"
                    deductions={[
                      ...(show(sig.produitsExcep) ? [{ label:'Produits exceptionnels', value:-sig.produitsExcep, groupeKey:'produitsExceptionnels' }] : []),
                      ...(show(sig.chargesExcep) ? [{ label:'Charges exceptionnelles', value:sig.chargesExcep, groupeKey:'chargesExceptionnelles' }] : []),
                    ]} {...rowProps} />
                )}
                <SigRow icon="✅" label="Résultat net" value={sig.rnet} pct={sig.tauxRnet} color={sig.rnet>=0?'#1D9E75':'#D85A30'} explain="Ce que vous gardez après tout" groupeKey="is"
                  deductions={[
                    ...(show(sig.participation) ? [{ label:'Participation des salariés', value:sig.participation, groupeKey:'participation' }] : []),
                    ...(show(sig.is) ? [{ label:'Impôt sur les sociétés', value:sig.is, groupeKey:'is' }] : []),
                  ]} {...rowProps} />
              </div>
              <div style={{ position:'sticky', top:24, alignSelf:'flex-start', flexShrink:0 }}>{panelData && <SidePanel data={panelData} onClose={() => setPanelData(null)} />}</div>
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
