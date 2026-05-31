'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AppSidebar from '@/components/Sidebar'
import PeriodSelector from '@/components/PeriodSelector'
import AlvioInsight from '@/components/AlvioInsight'
import DashboardBriefing from '@/components/DashboardBriefing'
import { calculerIndicateurs, getMonthlyCash, filtrerLignes } from '@/hooks/useFEC'
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

function PeriodBar({ annees, anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin }: any) {
  const [ddOpen, setDdOpen] = useState(false)
  const label = periodeTab === 'perso' && dateDebut && dateFin
    ? `${dateDebut.slice(8,10)}/${dateDebut.slice(5,7)} → ${dateFin.slice(8,10)}/${dateFin.slice(5,7)}`
    : `Exercice ${anneeActive}`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      {annees.length > 1 && (
        <div style={{ display: 'flex', background: '#F2F3F5', borderRadius: 6, padding: 2, gap: 2 }}>
          {annees.map((a: number) => (
            <div key={a} onClick={() => { setAnneeActive(a); setPeriodeTab('exercice') }}
              style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: anneeActive === a && periodeTab === 'exercice' ? '#fff' : 'transparent', color: anneeActive === a && periodeTab === 'exercice' ? '#1A1A1A' : '#8C9BAB', boxShadow: anneeActive === a && periodeTab === 'exercice' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {a}
            </div>
          ))}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setDdOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F2F3F5', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 500, color: '#1A1A1A', cursor: 'pointer' }}>
          {label}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="#8C9BAB" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        {ddOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 8, zIndex: 100, minWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div onClick={() => { setPeriodeTab('exercice'); setDdOpen(false) }}
              style={{ padding: '7px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', color: periodeTab === 'exercice' ? '#B8A98A' : '#1A1A1A', background: periodeTab === 'exercice' ? 'rgba(184,169,138,0.08)' : 'transparent' }}>
              Exercice complet
            </div>
            <div style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Personnalisé</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}>
              <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); setPeriodeTab('perso') }}
                style={{ border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 5, padding: '3px 6px', fontSize: 11, outline: 'none', color: '#1A1A1A' }} />
              <span style={{ fontSize: 11, color: '#8C9BAB' }}>→</span>
              <input type="date" value={dateFin} onChange={e => { setDateFin(e.target.value); setPeriodeTab('perso') }}
                style={{ border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 5, padding: '3px 6px', fontSize: 11, outline: 'none', color: '#1A1A1A' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [exercices, setExercices] = useState<Record<number, {annee:number;lignes:LigneFEC[];nomFichier:string}>>({})
  const [anneeActive, setAnneeActive] = useState(new Date().getFullYear())
  const [periodeTab, setPeriodeTab] = useState<'exercice'|'perso'>('exercice')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [anneeN1, setAnneeN1] = useState(new Date().getFullYear() - 1)
  const [dateDebutN1, setDateDebutN1] = useState('')
  const [dateFinN1, setDateFinN1] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await sb.from('fec_exercices').select('annee, ecritures, nom_fichier').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const map: Record<number, any> = {}
        for (const row of data) map[row.annee] = { annee: row.annee, lignes: row.ecritures as LigneFEC[], nomFichier: row.nom_fichier || `FEC ${row.annee}` }
        setExercices(map)
        setAnneeActive(data[0].annee)
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
  const ind: Indicateurs | null = lignesActives.length > 0 ? calculerIndicateurs(lignesActives) : null
  const indN1: Indicateurs | null = lignesN1.length > 0 ? calculerIndicateurs(lignesN1) : null
  const monthly = ind ? getMonthlyCash(lignesActives) : []

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

  const alvioMessage = (): string => {
    if (!ind) return ''
    const pts: string[] = []
    if (ind.ca > 0) {
      if (ind.tauxMb > 50) pts.push(`Marge brute solide à ${fmtP(ind.tauxMb)}`)
      else if (ind.tauxMb < 25) pts.push(`Marge brute faible à ${fmtP(ind.tauxMb)} — achats à revoir`)
      if (ind.tauxEbe >= 15) pts.push(`Excellent EBITDA à ${fmtP(ind.tauxEbe)} du CA`)
      else if (ind.tauxEbe < 5) pts.push(`EBITDA sous 5% (${fmtP(ind.tauxEbe)}) — structure de coûts à optimiser`)
      if (ind.treso < 0) pts.push(`Trésorerie négative — situation à surveiller`)
      else if (ind.treso > ind.ca * 0.3) pts.push(`Trésorerie confortable à ${fmtP(ind.treso/ind.ca*100)} du CA`)
    }
    return pts.length ? pts.join('. ') + '.' : 'Importez un FEC pour obtenir une analyse personnalisée.'
  }

  if (loading) return (
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

        {/* Topbar */}
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
          <label style={{ display:'flex', alignItems:'center', gap:7, background:'#1A1A1A', color:'#F2F3F5', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:500, cursor:'pointer' }}>
            {uploading ? '⏳ Import...' : '＋ Importer FEC'}
            <input type="file" accept=".txt,.csv,.tsv" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleFEC(e.target.files[0])} />
          </label>
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
                  deltaCA: indN1 && indN1.ca ? (ind.ca - indN1.ca) / Math.abs(indN1.ca) * 100 : undefined,
                }}
              />

              {/* 4 KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
                <KpiCard label="Chiffre d'affaires" value={fmt(ind.ca)} icon="📈" color="#B8A98A"
                  sub={indN1 ? undefined : undefined}
                  delta={indN1 && ind.ca > 0 ? { val: ind.ca - indN1.ca, pct: (ind.ca - indN1.ca) / indN1.ca * 100 } : null} />
                <KpiCard label="Marge brute" value={fmt(ind.mb)} sub={fmtP(ind.tauxMb) + ' du CA'} icon="💰" color="#B8A98A"
                  delta={indN1 && ind.mb > 0 ? { val: ind.mb - indN1.mb, pct: (ind.mb - indN1.mb) / Math.abs(indN1.mb || 1) * 100 } : null} />
                <KpiCard label="EBITDA" value={fmt(ind.ebe)} sub={fmtP(ind.tauxEbe) + ' du CA'} icon="⚡" color={ind.tauxEbe >= 10 ? '#1D9E75' : '#D85A30'}
                  delta={indN1 ? { val: ind.ebe - indN1.ebe, pct: (ind.ebe - indN1.ebe) / Math.abs(indN1.ebe || 1) * 100 } : null} />
                <KpiCard label="Résultat net" value={fmt(ind.rnet)} sub={fmtP(ind.tauxRnet) + ' du CA'} icon="🎯" color={ind.rnet >= 0 ? '#1D9E75' : '#D85A30'}
                  delta={indN1 ? { val: ind.rnet - indN1.rnet, pct: (ind.rnet - indN1.rnet) / Math.abs(indN1.rnet || 1) * 100 } : null} />
              </div>

              {/* Graphique trésorerie + KPI tréso */}
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14, marginBottom:24 }}>
                <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#1A1A1A' }}>Trésorerie cumulée</span>
                    <span style={{ fontSize:12, color: ind.treso >= 0 ? '#1D9E75' : '#D85A30', fontWeight:500 }}>{fmt(ind.treso)}</span>
                  </div>
                  <MiniBar data={monthly} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'16px 18px', flex:1 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>BFR</div>
                    <div style={{ fontSize:22, fontWeight:600, color: ind.bfr > 0 ? '#D85A30' : '#1D9E75' }}>{fmt(ind.bfr)}</div>
                    <div style={{ fontSize:11, color:'#8C9BAB', marginTop:4 }}>{ind.bfr > 0 ? 'Besoin à financer' : 'Ressource nette'}</div>
                  </div>
                  <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'16px 18px', flex:1 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Masse salariale</div>
                    <div style={{ fontSize:22, fontWeight:600, color: ind.tauxPers > 55 ? '#D85A30' : '#1A1A1A' }}>{fmtP(ind.tauxPers)}</div>
                    <div style={{ fontSize:11, color:'#8C9BAB', marginTop:4 }}>du chiffre d'affaires</div>
                  </div>
                </div>
              </div>

              {/* Navigation vers les autres pages */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  { href:'/profitability', label:'Rentabilité', icon:'📊', desc:`MB ${fmtP(ind.tauxMb)} · EBITDA ${fmtP(ind.tauxEbe)}`, color:'#B8A98A' },
                  { href:'/income-statement', label:'Compte de résultat', icon:'📋', desc:`Résultat net ${fmt(ind.rnet)}`, color: ind.rnet >= 0 ? '#1D9E75' : '#D85A30' },
                  { href:'/balance-sheet', label:'Bilan', icon:'⚖️', desc:`Tréso ${fmt(ind.treso)}`, color: ind.treso >= 0 ? '#1D9E75' : '#D85A30' },
                  { href:'/cash-flow', label:'Trésorerie', icon:'💧', desc:`BFR ${fmt(ind.bfr)}`, color: ind.bfr <= 0 ? '#1D9E75' : '#D85A30' },
                ].map(n => (
                  <a key={n.href} href={n.href} style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'16px 18px', textDecoration:'none', display:'block', transition:'box-shadow 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
                    <div style={{ fontSize:22, marginBottom:10 }}>{n.icon}</div>
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
