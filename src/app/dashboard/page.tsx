'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppSidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePeriod } from '@/hooks/usePeriod'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import DashboardBriefing from '@/components/DashboardBriefing'

const sb = createClient()
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

function NavCard({ href, label, icon, desc, color }: { href: string; label: string; icon: React.ReactNode; desc: string; color: string }) {
  const [hov, setHov] = useState(false)
  return (
    <a href={href}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:'var(--bg-card)', borderRadius:14, border:`1px solid ${hov ? '#C6A275' : 'var(--border-light)'}`, padding:'16px 18px', textDecoration:'none', display:'block', transition:'border-color .18s' }}>
      <div style={{ width:36, height:36, borderRadius:10, background: hov ? 'rgba(198,162,117,0.15)' : 'var(--alvio-champagne-subtle)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, transition:'background .18s' }}>{icon}</div>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:11, color, fontWeight:500 }}>{desc}</div>
      <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#C6A275" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </a>
  )
}

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
  const [deltas, setDeltas] = useState<{ deltaCA?: number; deltaMb?: number; deltaEbe?: number; deltaRnet?: number }>({})

  const pctDelta = (n: number, p: number) => (!p ? undefined : Math.round(((n - p) / Math.abs(p)) * 1000) / 10)

  const loadEtats = async (annee: number, params: string, withN1: boolean) => {
    const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${params}`)
    if (!res.ok) return
    const dN = await res.json()
    setEtats(dN)
    if (withN1 && dN?.sig) {
      const resN1 = await fetch(`/api/etats?annee=${annee - 1}&company_id=${activeId}`)
      const dN1 = resN1.ok ? await resN1.json() : null
      const s = dN.sig, p = dN1?.sig
      setDeltas(p ? {
        deltaCA: pctDelta(s.ca, p.ca),
        deltaMb: pctDelta(s.margeCommerciale, p.margeCommerciale),
        deltaEbe: pctDelta(s.ebe, p.ebe),
        deltaRnet: pctDelta(s.resultatNet, p.resultatNet),
      } : {})
    } else setDeltas({})
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      if (!activeId) { setLoading(false); return }

      const { data } = await sb.from('fec_exercices').select('annee').eq('company_id', activeId).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const anneesDispos = data.map((r: any) => r.annee as number)
        setAnnees(anneesDispos)
        const annee = anneesDispos.includes(anneeActive) ? anneeActive : anneesDispos[0]
        if (annee !== anneeActive) setAnneeActive(annee)
        await loadEtats(annee, periodeParams, periodeTab !== 'perso')
      }
      setLoading(false)
    }
    load()
  }, [activeId])

  useEffect(() => {
    if (!activeId || !annees.length) return
    const params = periodeTab === 'perso' && dateDebut && dateFin
      ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    loadEtats(anneeActive, params, periodeTab !== 'perso')
  }, [periodeTab, dateDebut, dateFin])

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee)
    const params = periodeTab === 'perso' && dateDebut && dateFin
      ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    await loadEtats(annee, params, periodeTab !== 'perso')
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
      await loadEtats(annee, periodeParams, periodeTab !== 'perso')
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

        {/* Wrapper position:relative pour le filigrane */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

          {/* Filigrane */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none', zIndex:0, width:600, height:600 }}>
            <svg viewBox="70 25 365 335" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%', opacity:0.15 }}>
              <path fill="#C6A275" d="M247.73,149.32c-2.59,6.14-5,11.83-7.39,17.53c-6.89,16.45-13.73,32.91-20.71,49.32c-0.48,1.14-1.79,2.14-2.95,2.74c-11.04,5.76-22.82,9.46-34.94,12.07c-6.36,1.37-12.82,2.3-19.23,3.41c-0.7,0.12-1.42,0.11-2.47,0.18c29.27-66.95,58.4-133.57,87.75-200.71c29.3,67.03,58.43,133.68,87.71,200.69c-1.62-0.15-2.96-0.21-4.29-0.41c-18.25-2.72-36.04-7.01-52.67-15.28c-0.98-0.49-2.09-1.34-2.5-2.29c-7.21-16.95-14.33-33.95-21.46-50.94C252.35,160.35,250.13,155.05,247.73,149.32z"/>
              <path fill="#C6A275" d="M385.17,348.23c-6.27-4.19-12.55-8.37-18.82-12.57c-22.52-15.1-45.04-30.19-67.51-45.35c-0.75-0.51-1.44-1.71-1.47-2.6c-0.14-5.04-0.11-10.08,0-15.11c0.02-0.78,0.55-1.95,1.19-2.26c14.39-7.07,28.83-14.05,43.55-21.18c14.63,33.23,29.04,65.95,43.45,98.67C385.43,347.97,385.3,348.1,385.17,348.23z"/>
              <path fill="#C6A275" d="M109.7,348.63c14.61-33.3,28.96-66,43.42-98.96c1.92,0.78,3.85,1.45,5.68,2.32c12.68,6.04,25.36,12.1,37.99,18.24c0.66,0.32,1.33,1.39,1.35,2.13c0.1,5.19,0.1,10.38-0.04,15.56c-0.02,0.83-0.73,1.93-1.45,2.41c-14.41,9.76-28.87,19.46-43.33,29.15c-13.72,9.2-27.46,18.36-41.19,27.54C111.52,347.45,110.9,347.85,109.7,348.63z"/>
              <path fill="#C6A275" d="M247.84,298.64c-2.69-5.84-5.39-11.34-7.78-16.97c-4.01-9.44-10.74-16.15-19.82-20.67c-3.97-1.98-7.94-3.95-11.91-5.93c-0.65-0.32-1.29-0.65-1.95-0.98c4.52-2.14,8.92-4.19,13.3-6.3c9.92-4.79,16.68-12.53,21.08-22.51c2.28-5.17,4.65-10.3,7-15.49c2.28,5.06,4.43,10.13,6.84,15.09c1.58,3.25,3.45,6.37,5.31,9.47c4.49,7.48,11.95,11.29,19.28,15.17c3.06,1.62,6.29,2.93,9.69,4.5c-1.41,0.69-2.67,1.26-3.89,1.92c-4.75,2.55-9.49,5.13-14.24,7.71c-6.45,3.5-10.76,8.97-13.92,15.39c-2.8,5.7-5.35,11.52-8,17.29C248.52,296.98,248.26,297.66,247.84,298.64z"/>
            </svg>
          </div>

          {/* Contenu */}
          <div style={{ position:'relative', zIndex:1, padding:24, overflowY:'auto', height:'100%' }}>
            {erreur && <div style={{ background:'rgba(180,35,24,0.06)', border:'1px solid rgba(180,35,24,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#D85A30' }}>{erreur}</div>}
            {!sig ? (
              <div style={{ maxWidth:420, margin:'80px auto', textAlign:'center' }}>
                <div style={{ width:64, height:64, borderRadius:18, background:'rgba(198,162,117,0.08)', border:'1px solid rgba(198,162,117,0.18)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <svg viewBox="80 34 340 315" width="32" height="32">
                    <path fill="#C6A275" d="M247.73,149.32c-2.59,6.14-5,11.83-7.39,17.53c-6.89,16.45-13.73,32.91-20.71,49.32c-0.48,1.14-1.79,2.14-2.95,2.74c-11.04,5.76-22.82,9.46-34.94,12.07c-6.36,1.37-12.82,2.3-19.23,3.41c-0.7,0.12-1.42,0.11-2.47,0.18c29.27-66.95,58.4-133.57,87.75-200.71c29.3,67.03,58.43,133.68,87.71,200.69c-1.62-0.15-2.96-0.21-4.29-0.41c-18.25-2.72-36.04-7.01-52.67-15.28c-0.98-0.49-2.09-1.34-2.5-2.29c-7.21-16.95-14.33-33.95-21.46-50.94C252.35,160.35,250.13,155.05,247.73,149.32z"/>
                    <path fill="#C6A275" d="M385.17,348.23c-6.27-4.19-12.55-8.37-18.82-12.57c-22.52-15.1-45.04-30.19-67.51-45.35c-0.75-0.51-1.44-1.71-1.47-2.6c-0.14-5.04-0.11-10.08,0-15.11c0.02-0.78,0.55-1.95,1.19-2.26c14.39-7.07,28.83-14.05,43.55-21.18c14.63,33.23,29.04,65.95,43.45,98.67C385.43,347.97,385.3,348.1,385.17,348.23z"/>
                    <path fill="#C6A275" d="M109.7,348.63c14.61-33.3,28.96-66,43.42-98.96c1.92,0.78,3.85,1.45,5.68,2.32c12.68,6.04,25.36,12.1,37.99,18.24c0.66,0.32,1.33,1.39,1.35,2.13c0.1,5.19,0.1,10.38-0.04,15.56c-0.02,0.83-0.73,1.93-1.45,2.41c-14.41,9.76-28.87,19.46-43.33,29.15c-13.72,9.2-27.46,18.36-41.19,27.54C111.52,347.45,110.9,347.85,109.7,348.63z"/>
                    <path fill="#C6A275" d="M247.84,298.64c-2.69-5.84-5.39-11.34-7.78-16.97c-4.01-9.44-10.74-16.15-19.82-20.67c-3.97-1.98-7.94-3.95-11.91-5.93c-0.65-0.32-1.29-0.65-1.95-0.98c4.52-2.14,8.92-4.19,13.3-6.3c9.92-4.79,16.68-12.53,21.08-22.51c2.28-5.17,4.65-10.3,7-15.49c2.28,5.06,4.43,10.13,6.84,15.09c1.58,3.25,3.45,6.37,5.31,9.47c4.49,7.48,11.95,11.29,19.28,15.17c3.06,1.62,6.29,2.93,9.69,4.5c-1.41,0.69-2.67,1.26-3.89,1.92c-4.75,2.55-9.49,5.13-14.24,7.71c-6.45,3.5-10.76,8.97-13.92,15.39c-2.8,5.7-5.35,11.52-8,17.29C248.52,296.98,248.26,297.66,247.84,298.64z"/>
                  </svg>
                </div>
                <div style={{ fontSize:16, fontWeight:700, color:'#242628', marginBottom:8, letterSpacing:'-0.02em' }}>Bienvenue sur Alvio</div>
                <div style={{ fontSize:13, color:'#6E7378', marginBottom:28, lineHeight:1.7 }}>Pour accéder à votre tableau de bord, configurez votre dossier et importez votre premier FEC.</div>
                <a href="/entreprise" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#C6A275', color:'#fff', borderRadius:10, padding:'11px 24px', fontSize:13, fontWeight:600, textDecoration:'none', marginBottom:20 }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.5" stroke="#fff" strokeWidth="1.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Accéder aux paramétrages
                </a>
                <div style={{ textAlign:'left', background:'#FAFAF8', border:'1px solid #ECECEC', borderRadius:12, padding:'18px 22px', display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    { n:'1', label:'Créez votre dossier', desc:'Nommez votre société dans l\u2019onglet Général' },
                    { n:'2', label:'Importez un FEC', desc:'Glissez votre fichier dans l\u2019onglet Exercices & FEC' },
                    { n:'3', label:'Ou connectez Pennylane', desc:'Synchronisez depuis l\u2019onglet Exercices & FEC' },
                  ].map(s => (
                    <div key={s.n} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(198,162,117,0.12)', border:'1px solid rgba(198,162,117,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#C6A275', flexShrink:0, marginTop:1 }}>{s.n}</div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:'#242628', marginBottom:1 }}>{s.label}</div>
                        <div style={{ fontSize:11, color:'#6E7378' }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ maxWidth:1100 }}>
                <DashboardBriefing
                  prenom={(() => { try { const raw = localStorage.getItem('sb-gsflplpmiukbwuewivps-auth-token'); const u = JSON.parse(raw || '{}'); const meta = u?.user?.user_metadata; return meta?.prenom || meta?.full_name?.split(' ')[0] || u?.user?.email?.split('@')[0] || ''; } catch(e) { return ''; } })()}
                  metrics={{
                    chiffreAffaires: sig.ca,
                    resultatNet: sig.resultatNet,
                    tresorerie: bilan?.actif?.tresorerie ?? 0,
                    margebrute: sig.margeCommerciale,
                    tauxMb: sig.tauxMb,
                    ebitda: sig.ebe,
                    tauxEbe: sig.tauxEbe,
                    detteFournisseurs: bilan?.passif?.dettesFournisseurs ?? 0,
                    creancesClients: bilan?.actif?.creancesClients ?? 0,
                    deltaCA: deltas.deltaCA,
                    deltaMb: deltas.deltaMb,
                    deltaEbe: deltas.deltaEbe,
                    deltaRnet: deltas.deltaRnet,
                    mensuel: etats?.mensuel,
                    chargesParNature: etats?.chargesParNature,
                  }}
                />

                {/* Navigation */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  {[
                    {
                      href:'/performances', label:'Performances',
                      icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polyline points="2,14 7,8 11,11 18,4" stroke="#C6A275" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14,4 18,4 18,8" stroke="#C6A275" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                      desc:`MB ${fmtP(sig.tauxMb)} · EBITDA ${fmtP(sig.tauxEbe)}`, color:'#B8A98A'
                    },
                    {
                      href:'/sante-financiere', label:'Santé financière',
                      icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 10h3.5l2-5 3 10 2-6 1.5 1H18" stroke="#C6A275" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                      desc:`Tréso ${fmt(bilan?.actif?.tresorerie ?? 0)}`, color: (bilan?.actif?.tresorerie ?? 0) >= 0 ? '#0F8A5F' : '#B42318'
                    },
                    {
                      href:'/entreprise', label:'Paramétrages',
                      icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.5" stroke="#C6A275" strokeWidth="1.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4" stroke="#C6A275" strokeWidth="1.5" strokeLinecap="round"/></svg>,
                      desc:`Dossiers · FEC · Pennylane`, color:'#9CA3AF'
                    },
                  ].map(n => <NavCard key={n.href} href={n.href} label={n.label} icon={n.icon} desc={n.desc} color={n.color} />)}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      <AlvioAvatar />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}@keyframes alvioFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes alvioPop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}'}</style>
    </div>
  )
}

/* ── Avatar Alvio flottant (sticker transparent, bas droite) ─────────── */
function AlvioAvatar() {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ position: 'fixed', bottom: 0, right: 18, zIndex: 60, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {open && (
        <div style={{
          maxWidth: 250, marginTop: 14, background: '#fff', border: '1px solid var(--border-light)', borderRadius: 16, borderBottomRightRadius: 4,
          padding: '13px 15px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', position: 'relative', animation: 'alvioPop .28s cubic-bezier(0.22,1,0.36,1)', alignSelf: 'flex-start',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#C6A275', letterSpacing: '0.02em' }}>Alvio · CFO Digital</span>
            <button onClick={() => setOpen(false)} aria-label="Masquer"
              style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 6, width: 20, height: 20, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            J'ai analysé vos données. Voici les informations les plus importantes pour piloter votre entreprise aujourd'hui.
          </p>
          {/* petite pointe vers l'avatar */}
          <span style={{ position: 'absolute', top: 22, right: -6, width: 12, height: 12, background: '#fff', borderRight: '1px solid var(--border-light)', borderTop: '1px solid var(--border-light)', transform: 'rotate(45deg)' }} />
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Masquer Alvio' : 'Afficher Alvio'}
        style={{
          border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0,
          animation: 'alvioFloat 4.5s ease-in-out infinite', lineHeight: 0,
        }}>
        <img src="/avatar-alvio.png" alt="Alvio" style={{ height: 165, width: 'auto', display: 'block', filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.22))' }} />
      </button>
    </div>
  )
}
