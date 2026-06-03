'use client'
import { useState, useEffect } from 'react'
import { usePeriod } from '@/hooks/usePeriod'
import { createClient } from '@supabase/supabase-js'
import AppSidebar from '@/components/Sidebar'
import PeriodSelector from '@/components/PeriodSelector'
import AlvioInsight from '@/components/AlvioInsight'
import DashboardBriefing from '@/components/DashboardBriefing'
import { calculerIndicateurs, getMonthlyCash, filtrerLignes } from '@/hooks/useFEC'
import { usePCG } from '@/hooks/usePCG'
import type { LigneFEC, Indicateurs } from '@/hooks/useFEC'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)
  return d
}

interface ExData { annee: number; lignes: LigneFEC[]; nomFichier: string }

function Delta({ val, pct }: { val: number; pct: number }) {
  const up = val >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
      <span style={{ fontSize: 10, color: up ? '#1D9E75' : '#D85A30', fontWeight: 600 }}>
        {up ? '▲' : '▼'} {up ? '+' : ''}{fmt(val)} ({up ? '+' : ''}{fmtP(pct)}) vs N-1
      </span>
    </div>
  )
}

function KpiCard({ label, value, sub, color, delta, icon }: { label: string; value: string; sub?: string; color: string; delta?: { val: number; pct: number } | null; icon: string }) {
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? '#1A1A1A' : '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '20px 20px 16px', borderTop: `3px solid ${color}`, position: 'relative', overflow: 'hidden', transition: 'background 0.25s, box-shadow 0.25s, transform 0.2s', transform: hov ? 'translateY(-3px)' : 'none', boxShadow: hov ? '0 12px 32px rgba(0,0,0,0.12)' : 'none', cursor: 'default' }}>
      <div style={{ position: 'absolute', top: 14, right: 16, fontSize: 22, opacity: 0.12 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: hov ? 'rgba(255,255,255,0.5)' : '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: hov ? '#fff' : '#1A1A1A', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: hov ? 'rgba(255,255,255,0.7)' : color, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
      {delta && <Delta val={delta.val} pct={delta.pct} />}
    </div>
  )
}

function MiniBar({ data }: { data: { m: string; val: number }[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => Math.abs(d.val))) || 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160 }}>
      {data.map((d, i) => {
        const h = Math.max(Math.abs(d.val) / max * 100, 4)
        const isLast = i === data.length - 1
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: '100%', height: `${h}%`, minHeight: 3, background: isLast ? '#1A1A1A' : d.val >= 0 ? '#1D9E75' : '#D85A30', borderRadius: '2px 2px 0 0' }} />
            <span style={{ fontSize: 8, color: '#8C9BAB', whiteSpace: 'nowrap' }}>{d.m}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const [exercices, setExercices] = useState<Record<number, {annee:number;lignes:LigneFEC[];nomFichier:string}>>({})
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [typePcg, setTypePcg] = useState<'classique'|'asso'>('classique')
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur] = useState('')
  const { mappings, pcgLoading } = usePCG(typePcg)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await sb.from('fec_exercices').select('annee, ecritures, nom_fichier, type_pcg').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const map: Record<number, any> = {}
        for (const row of data) map[row.annee] = { annee: row.annee, lignes: row.ecritures as LigneFEC[], nomFichier: row.nom_fichier || `FEC ${row.annee}` }
        setExercices(map)
        if (typeof window === 'undefined' || !localStorage.getItem('alvio-period')) setAnneeActive(data[0].annee)
        setTypePcg((data[0].type_pcg as 'classique'|'asso') || 'classique')
      }
      setLoading(false)
    }
    load()
  }, [])

  const lignesActives: LigneFEC[] = (() => {
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
  })()

  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)

  const lignesN1: LigneFEC[] = (() => {
    if (dateDebutN1 && dateFinN1) {
      const merged: LigneFEC[] = []
      for (const a of Object.keys(exercices).map(Number).sort((x,y) => x-y)) {
        const ex = exercices[a]; if (!ex) continue
        const dates = ex.lignes.map((l:LigneFEC) => toIso(l.EcritureDate)).filter(Boolean).sort()
        if (dates.length && toIso(dates[dates.length-1]) >= dateDebutN1 && toIso(dates[0]) <= dateFinN1)
          merged.push(...filtrerLignes(ex.lignes, 'perso', dateDebutN1, dateFinN1))
      }
      if (merged.length > 0) return merged
    }
    return exercices[anneeN1]?.lignes ?? []
  })()

  const pcg = mappings?.sig ?? {}
  const index = mappings?.allIndex
  const hasPCG = Object.keys(pcg).length > 0 && !!index
  const ind: Indicateurs | null = (lignesActives.length > 0 && hasPCG) ? calculerIndicateurs(lignesActives, pcg, index!) : null
  const indN1: Indicateurs | null = (lignesN1.length > 0 && hasPCG) ? calculerIndicateurs(lignesN1, pcg, index!) : null
  const monthly = (ind && hasPCG) ? getMonthlyCash(lignesActives, pcg, index!) : []

  const handleFEC = async (file: File) => {
    setUploading(true); setErreur('')
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      const sep = lines[0].includes('|') ? '|' : lines[0].includes(';') ? ';' : '\t'
      const headers = lines[0].split(sep).map((h:string) => h.trim().replace(/^"|"$/g,''))
      const idx = (n:string) => headers.findIndex((h:string) => h.toLowerCase() === n.toLowerCase())
      const iNum = idx('CompteNum'), iLib = idx('CompteLib'), iDeb = idx('Debit'), iCre = idx('Credit'), iDate = idx('EcritureDate'), iELib = idx('EcritureLib'), iPiece = idx('PieceRef')
      const lignes: LigneFEC[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map((c:string) => c.trim().replace(/^"|"$/g,''))
        if (cols.length < 3) continue
        const debit = parseFloat((cols[iDeb]||'0').replace(',','.')) || 0
        const credit = parseFloat((cols[iCre]||'0').replace(',','.')) || 0
        lignes.push({ CompteNum: cols[iNum]||'', CompteLib: cols[iLib]||'', Debit: debit, Credit: credit, EcritureDate: cols[iDate]||'', EcritureLib: cols[iELib]||'', PieceRef: cols[iPiece]||'' })
      }
      const dates = lignes.map(l => toIso(l.EcritureDate)).filter(Boolean).sort()
      const annee = dates.length ? parseInt(dates[dates.length-1].slice(0,4)) : new Date().getFullYear()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      await sb.from('fec_exercices').upsert({ user_id: user.id, annee, ecritures: lignes, nom_fichier: file.name }, { onConflict: 'user_id,annee' })
      setExercices(prev => ({ ...prev, [annee]: { annee, lignes, nomFichier: file.name } }))
      setAnneeActive(annee)
    } catch(e) { setErreur('Erreur lors du traitement du FEC') }
    finally { setUploading(false) }
  }

  if (loading || pcgLoading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
      <AppSidebar activePage="dashboard"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
      <AppSidebar activePage="dashboard"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Synthèse</span>
            {ind && (
              <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive}
                periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
                dateDebut={dateDebut} setDateDebut={setDateDebut}
                dateFin={dateFin} setDateFin={setDateFin} anneeN1={anneeN1} setAnneeN1={setAnneeN1} dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1} dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />
            )}
          </div>
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {erreur && <div style={{ background:'rgba(216,90,48,0.08)', border:'0.5px solid rgba(216,90,48,0.3)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#D85A30' }}>{erreur}</div>}
          {!ind ? (
            <div style={{ maxWidth:520, margin:'80px auto', textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:16, background:'rgba(184,169,138,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:28 }}>📂</div>
              <div style={{ fontSize:16, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucun fichier FEC importé</div>
              <div style={{ fontSize:13, color:'#8C9BAB', marginBottom:28, lineHeight:1.6 }}>Importez votre fichier FEC pour accéder à l'analyse financière complète.</div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#1A1A1A', color:'#fff', borderRadius:10, padding:'12px 24px', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                {uploading ? 'Traitement en cours...' : 'Importer mon FEC'}
                <input type="file" accept=".txt,.csv,.tsv" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleFEC(e.target.files[0])} />
              </label>
            </div>
          ) : (
            <div style={{ maxWidth:1100 }}>
              <DashboardBriefing
                prenom={(() => { try { const raw = localStorage.getItem('sb-gsflplpmiukbwuewivps-auth-token'); const u = JSON.parse(raw || '{}'); const meta = u?.user?.user_metadata; return meta?.prenom || meta?.full_name?.split(' ')[0] || u?.user?.email?.split('@')[0] || ''; } catch(e) { return ''; } })()}
                metrics={{
                  chiffreAffaires: ind.ca,
                  resultatNet: ind.rnet,
                  tresorerie: ind.treso,
                  bfr: ind.bfr,
                  margebrute: ind.mb,
                  tauxMb: ind.tauxMb,
                  ebitda: ind.ebe,
                  tauxEbe: ind.tauxEbe,
                  detteFournisseurs: ind.dettes,
                  creancesClients: ind.creances,
                  deltaCA: indN1 && indN1.ca ? (ind.ca - indN1.ca) / Math.abs(indN1.ca) * 100 : undefined,
                  deltaMb: indN1 && indN1.mb ? (ind.mb - indN1.mb) / Math.abs(indN1.mb) * 100 : undefined,
                  deltaEbe: indN1 && indN1.ebe ? (ind.ebe - indN1.ebe) / Math.abs(indN1.ebe) * 100 : undefined,
                  deltaRnet: indN1 && indN1.rnet ? (ind.rnet - indN1.rnet) / Math.abs(indN1.rnet) * 100 : undefined,
                }}
              />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  { href:'/profitability', label:'Rentabilité', icon:'profitability', desc:`MB ${fmtP(ind.tauxMb)} · EBITDA ${fmtP(ind.tauxEbe)}`, color:'#B8A98A' },
                  { href:'/income-statement', label:'Compte de résultat', icon:'income', desc:`Résultat net ${fmt(ind.rnet)}`, color: ind.rnet >= 0 ? '#1D9E75' : '#D85A30' },
                  { href:'/balance-sheet', label:'Bilan', icon:'balance', desc:`Tréso ${fmt(ind.treso)}`, color: ind.treso >= 0 ? '#1D9E75' : '#D85A30' },
                  { href:'/cash-flow', label:'Trésorerie', icon:'cashflow', desc:`BFR ${fmt(ind.bfr)}`, color: ind.bfr <= 0 ? '#1D9E75' : '#D85A30' },
                ].map(n => (
                  <a key={n.href} href={n.href} style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'16px 18px', textDecoration:'none', display:'block', transition:'box-shadow 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                    <div style={{ width:36, height:36, marginBottom:10, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, background:'rgba(184,169,138,0.1)' }}>
                      {n.icon === 'profitability' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
                      {n.icon === 'income' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>}
                      {n.icon === 'balance' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                      {n.icon === 'cashflow' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
                    </div>
                    <div style={{ fontSize:12, fontWeight:500, color:'#1A1A1A', marginBottom:4 }}>{n.label}</div>
                    <div style={{ fontSize:11, color: n.color, fontWeight:500 }}>{n.desc}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
