'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AppSidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePeriod } from '@/hooks/usePeriod'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import DashboardBriefing from '@/components/DashboardBriefing'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

export default function DashboardPage() {
  const [etats, setEtats] = useState<any>(null)
  const [annees, setAnnees] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur] = useState('')
  const [userId, setUserId] = useState<string>('')
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const { activeId } = useActiveCompany()
  const periodeParams = periodeTab === 'perso' && dateDebut && dateFin
    ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      if (!activeId) return  // attend la résolution du dossier actif (spinner maintenu)

      // Récupérer les années disponibles
      const { data } = await sb.from('fec_exercices').select('annee').eq('company_id', activeId).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const anneesDispos = data.map((r: any) => r.annee as number)
        setAnnees(anneesDispos)
        const annee = anneesDispos.includes(anneeActive) ? anneeActive : anneesDispos[0]
        if (annee !== anneeActive) setAnneeActive(annee)
        // Appel moteur comptable
        const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${periodeParams}`)
        if (res.ok) setEtats(await res.json())
      }
      setLoading(false)
    }
    load()
  }, [activeId])

  // Relance le fetch quand la période change
  useEffect(() => {
    if (!activeId || !annees.length) return
    const params = periodeTab === 'perso' && dateDebut && dateFin
      ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    fetch(`/api/etats?annee=${anneeActive}&company_id=${activeId}${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setEtats(d))
  }, [periodeTab, dateDebut, dateFin])

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee)
    const params = periodeTab === 'perso' && dateDebut && dateFin
      ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${params}`)
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
      await sb.from('fec_exercices').upsert({ user_id: user.id, company_id: activeId, annee, ecritures: lignes, nom_fichier: file.name }, { onConflict: 'company_id,annee' })
      setAnnees(prev => [...new Set([annee, ...prev])].sort((a,b) => b-a))
      setAnneeActive(annee)
      setUserId(user.id)
      const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${periodeParams}`)
      if (res.ok) setEtats(await res.json())
    } catch(e) { setErreur('Erreur lors du traitement du FEC') }
    finally { setUploading(false) }
  }

  const sig = etats?.sig
  const bilan = etats?.bilan

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-main)', fontFamily:"inherit" }}>
      <AppSidebar activePage="dashboard"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid var(--bg-main)', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-main)', fontFamily:"inherit" }}>
      <AppSidebar activePage="dashboard"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <TopBar title="Synthèse" annees={annees} anneeActive={anneeActive} onChangerAnnee={changerAnnee}
          periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
          dateDebut={dateDebut} setDateDebut={setDateDebut}
          dateFin={dateFin} setDateFin={setDateFin}
          anneeN1={anneeN1} setAnneeN1={setAnneeN1}
          dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1}
          dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} showN1={false} />
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {erreur && <div style={{ background:'rgba(180,35,24,0.06)', border:'1px solid rgba(180,35,24,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#D85A30' }}>{erreur}</div>}
          {!sig ? (
            <div style={{ maxWidth:520, margin:'80px auto', textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:16, background:'rgba(184,169,138,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:28 }}>📂</div>
              <div style={{ fontSize:16, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucun fichier FEC importé</div>
              <div style={{ fontSize:13, color:'#8C9BAB', marginBottom:28, lineHeight:1.6 }}>Importez votre fichier FEC pour accéder à l'analyse financière complète.</div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:8, background:'var(--alvio-champagne)', color:'var(--brand-dark)', borderRadius:10, padding:'12px 24px', fontSize:13, fontWeight:500, cursor:'pointer' }}>
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

              {/* Navigation */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  {
                    href:'/profitability', label:'Rentabilité',
                    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polyline points="2,14 7,8 11,11 18,4" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14,4 18,4 18,8" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                    desc:`MB ${fmtP(sig.tauxMb)} · EBITDA ${fmtP(sig.tauxEbe)}`, color:'#B8A98A'
                  },
                  {
                    href:'/income-statement', label:'Compte de résultat',
                    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#B8A98A" strokeWidth="1.5"/><line x1="6" y1="7" x2="14" y2="7" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/><line x1="6" y1="10.5" x2="14" y2="10.5" stroke="#A99672" strokeWidth="1.2" strokeLinecap="round"/><line x1="6" y1="14" x2="10" y2="14" stroke="#A99672" strokeWidth="1.2" strokeLinecap="round"/></svg>,
                    desc:`Résultat net ${fmt(sig.resultatNet)}`, color: sig.resultatNet >= 0 ? '#0F8A5F' : '#B42318'
                  },
                  {
                    href:'/sante-financiere', label:'Santé financière',
                    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 10h3.5l2-5 3 10 2-6 1.5 1H18" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                    desc:`Tréso ${fmt(bilan?.actif?.tresorerie ?? 0)}`, color: (bilan?.actif?.tresorerie ?? 0) >= 0 ? '#0F8A5F' : '#B42318'
                  },
                  {
                    href:'/entreprise', label:'Paramétrages',
                    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.5" stroke="#B8A98A" strokeWidth="1.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/></svg>,
                    desc:`Dossiers · FEC · Pennylane`, color:'#9CA3AF'
                  },
                ].map(n => (
                  <a key={n.href} href={n.href} style={{ background:'var(--bg-card)', borderRadius:14, border:'1px solid var(--border-light)', padding:'16px 18px', textDecoration:'none', display:'block', transition:'border-color 0.15s' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'var(--alvio-champagne-subtle)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>{n.icon}</div>
                    <div style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)', marginBottom:4 }}>{n.label}</div>
                    <div style={{ fontSize:11, color: n.color, fontWeight:500 }}>{n.desc}</div>
                    <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
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
