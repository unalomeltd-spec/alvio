'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AppSidebar from '@/components/Sidebar'
import DashboardBriefing from '@/components/DashboardBriefing'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

export default function DashboardPage() {
  const [etats, setEtats] = useState<any>(null)
  const [annees, setAnnees] = useState<number[]>([])
  const [anneeActive, setAnneeActive] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur] = useState('')
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUserId(user.id)

      // Récupérer les années disponibles
      const { data } = await sb.from('fec_exercices').select('annee').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const anneesDispos = data.map((r: any) => r.annee as number)
        setAnnees(anneesDispos)
        const annee = anneesDispos[0]
        setAnneeActive(annee)
        // Appel moteur comptable
        const res = await fetch(`/api/etats?annee=${annee}&user_id=${user.id}`)
        if (res.ok) setEtats(await res.json())
      }
      setLoading(false)
    }
    load()
  }, [])

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee)
    setEtats(null)
    const res = await fetch(`/api/etats?annee=${annee}&user_id=${userId}`)
    if (res.ok) setEtats(await res.json())
  }

  function toIso(d: string): string {
    if (!d) return ''
    if (d.includes('-')) return d.slice(0, 10)
    if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)
    return d
  }

  const handleFEC = async (file: File) => {
    setUploading(true); setErreur('')
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      const sep = lines[0].includes('|') ? '|' : lines[0].includes(';') ? ';' : '\t'
      const headers = lines[0].split(sep).map((h: string) => h.trim().replace(/^"|"$/g,''))
      const idx = (n: string) => headers.findIndex((h: string) => h.toLowerCase() === n.toLowerCase())
      const iNum = idx('CompteNum'), iLib = idx('CompteLib'), iDeb = idx('Debit'), iCre = idx('Credit')
      const iDate = idx('EcritureDate'), iELib = idx('EcritureLib'), iPiece = idx('PieceRef'), iJour = idx('JournalCode')
      const lignes: any[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map((c: string) => c.trim().replace(/^"|"$/g,''))
        if (cols.length < 3) continue
        const debit = parseFloat((cols[iDeb]||'0').replace(',','.')) || 0
        const credit = parseFloat((cols[iCre]||'0').replace(',','.')) || 0
        lignes.push({
          CompteNum: cols[iNum]||'', CompteLib: cols[iLib]||'',
          Debit: debit, Credit: credit,
          EcritureDate: cols[iDate]||'', EcritureLib: cols[iELib]||'',
          PieceRef: cols[iPiece]||'',
          JournalCode: iJour >= 0 ? cols[iJour]||'' : undefined
        })
      }
      const dates = lignes.map(l => toIso(l.EcritureDate)).filter(Boolean).sort()
      const annee = dates.length ? parseInt(dates[dates.length-1].slice(0,4)) : new Date().getFullYear()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      await sb.from('fec_exercices').upsert({ user_id: user.id, annee, ecritures: lignes, nom_fichier: file.name }, { onConflict: 'user_id,annee' })
      setAnnees(prev => [...new Set([annee, ...prev])].sort((a,b) => b-a))
      setAnneeActive(annee)
      setUserId(user.id)
      const res = await fetch(`/api/etats?annee=${annee}&user_id=${user.id}`)
      if (res.ok) setEtats(await res.json())
    } catch(e) { setErreur('Erreur lors du traitement du FEC') }
    finally { setUploading(false) }
  }

  const sig = etats?.sig
  const bilan = etats?.bilan

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
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Synthèse</span>
            {annees.length > 1 && (
              <div style={{ display:'flex', gap:6 }}>
                {annees.map(a => (
                  <button key={a} onClick={() => changerAnnee(a)}
                    style={{ fontSize:12, fontWeight:500, padding:'4px 10px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.12)', background: a === anneeActive ? '#1A1A1A' : '#fff', color: a === anneeActive ? '#fff' : '#1A1A1A', cursor:'pointer' }}>
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {erreur && <div style={{ background:'rgba(216,90,48,0.08)', border:'0.5px solid rgba(216,90,48,0.3)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#D85A30' }}>{erreur}</div>}
          {!sig ? (
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
                  chiffreAffaires: sig.ca,
                  resultatNet: sig.resultatNet,
                  tresorerie: bilan?.actif?.tresorerie ?? 0,
                  bfr: (bilan?.actif?.creancesClients ?? 0) - (bilan?.passif?.dettesFournisseurs ?? 0),
                  margebrute: sig.margeCommerciale,
                  tauxMb: sig.tauxMb,
                  ebitda: sig.ebe,
                  tauxEbe: sig.tauxEbe,
                  detteFournisseurs: bilan?.passif?.dettesFournisseurs ?? 0,
                  creancesClients: bilan?.actif?.creancesClients ?? 0,
                }}
              />

              {/* KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                {[
                  { label:'Chiffre d\'affaires', value: fmt(sig.ca), sub: `${fmtP(100)} du CA`, color:'#B8A98A' },
                  { label:'Marge brute', value: fmt(sig.margeCommerciale), sub: fmtP(sig.tauxMb) + ' du CA', color:'#B8A98A' },
                  { label:'EBE', value: fmt(sig.ebe), sub: fmtP(sig.tauxEbe) + ' du CA', color: sig.ebe >= 0 ? '#1D9E75' : '#D85A30' },
                  { label:'Résultat net', value: fmt(sig.resultatNet), sub: fmtP(sig.tauxRnet) + ' du CA', color: sig.resultatNet >= 0 ? '#1D9E75' : '#D85A30' },
                  { label:'Trésorerie', value: fmt(bilan?.actif?.tresorerie ?? 0), sub: 'Disponibilités', color: (bilan?.actif?.tresorerie ?? 0) >= 0 ? '#1D9E75' : '#D85A30' },
                  { label:'Créances clients', value: fmt(bilan?.actif?.creancesClients ?? 0), sub: 'Comptes 41x', color:'#8C9BAB' },
                  { label:'Dettes fournisseurs', value: fmt(bilan?.passif?.dettesFournisseurs ?? 0), sub: 'Comptes 40x', color:'#8C9BAB' },
                ].map((k, i) => (
                  <div key={i} style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'16px 20px', borderTop:`3px solid ${k.color}` }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{k.label}</div>
                    <div style={{ fontSize:22, fontWeight:600, color:'#1A1A1A' }}>{k.value}</div>
                    <div style={{ fontSize:11, color: k.color, marginTop:4, fontWeight:500 }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  { href:'/profitability', label:'Rentabilité', icon:'📈', desc:`MB ${fmtP(sig.tauxMb)} · EBITDA ${fmtP(sig.tauxEbe)}`, color:'#B8A98A' },
                  { href:'/income-statement', label:'Compte de résultat', icon:'📄', desc:`Résultat net ${fmt(sig.resultatNet)}`, color: sig.resultatNet >= 0 ? '#1D9E75' : '#D85A30' },
                  { href:'/balance-sheet', label:'Bilan', icon:'⚖️', desc:`Tréso ${fmt(bilan?.actif?.tresorerie ?? 0)}`, color: (bilan?.actif?.tresorerie ?? 0) >= 0 ? '#1D9E75' : '#D85A30' },
                  { href:'/cash-flow', label:'Trésorerie', icon:'💳', desc:`Actif ${fmt(bilan?.actif?.totalActif ?? 0)}`, color:'#8C9BAB' },
                ].map(n => (
                  <a key={n.href} href={n.href} style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'16px 18px', textDecoration:'none', display:'block' }}>
                    <div style={{ fontSize:24, marginBottom:10 }}>{n.icon}</div>
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
