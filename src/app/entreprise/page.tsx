'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import { parseFEC, detectAnnee } from '@/lib/fec-parser'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface EntrepriseInfo {
  siren: string; siret_siege: string; nom: string; forme_juridique: string
  capital: number | null; date_creation: string; code_naf: string; libelle_naf: string
  adresse: string; ville: string; code_postal: string; tranche_effectif: string
  dirigeants: { nom: string; fonction: string }[]
}

interface FecExercice {
  annee: number; nom_fichier: string; nb_ecritures: number
}

interface PennylaneConnection {
  id: string; company_name: string; company_reg_no: string; created_at: string; updated_at: string
}

const fmtSiren = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')
const fmtSiret = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4')

export default function EntreprisePage() {
  const [entreprise, setEntreprise] = useState<EntrepriseInfo | null>(null)
  const [fecExercices, setFecExercices] = useState<FecExercice[]>([])
  const [siren, setSiren] = useState('')
  const [chargement, setChargement] = useState(true)
  const [sirenInput, setSirenInput] = useState('')
  const [sirenLoading, setSirenLoading] = useState(false)
  const [sirenError, setSirenError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [onglet, setOnglet] = useState<'general' | 'fec'>('general')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [deletingAnnee, setDeletingAnnee] = useState<number | null>(null)
  const [exKpis, setExKpis] = useState<Record<number,{ca:number;mb:number;tauxMb:number;ebe:number;tauxEbe:number;rnet:number;treso:number}>>({})
  const [userId, setUserId] = useState<string | null>(null)

  // ── Pennylane ──
  const [pnxConnections, setPnxConnections] = useState<PennylaneConnection[]>([])
  const [pnxToken, setPnxToken] = useState('')
  const [pnxConnecting, setPnxConnecting] = useState(false)
  const [pnxMsg, setPnxMsg] = useState('')
  const [pnxSyncingId, setPnxSyncingId] = useState<string | null>(null)
  const [pnxSyncAnnee, setPnxSyncAnnee] = useState<Record<string, number>>({})
  const [pnxDeletingId, setPnxDeletingId] = useState<string | null>(null)

  const rechargerFec = async (uid: string) => {
    const { data: fecData } = await supabase
      .from('fec_exercices').select('annee, nom_fichier, ecritures')
      .eq('user_id', uid).order('annee', { ascending: false })
    if (fecData) {
      const kpisMap: Record<number,any> = {}
      await Promise.all(fecData.map(async (r) => {
        try {
          const res = await fetch(`/api/etats?annee=${r.annee}&user_id=${uid}`)
          if (res.ok) {
            const etats = await res.json()
            const sig = etats?.sig
            const bilan = etats?.bilan
            if (sig) {
              kpisMap[r.annee] = {
                ca: sig.ca, mb: sig.margeCommerciale, tauxMb: sig.tauxMb,
                ebe: sig.ebe, tauxEbe: sig.tauxEbe, rnet: sig.resultatNet,
                treso: bilan?.actif?.tresorerie ?? 0,
              }
            }
          }
        } catch (e) { console.error(e) }
      }))
      setExKpis(kpisMap)
      setFecExercices(fecData.map(r => ({
        annee: r.annee,
        nom_fichier: r.nom_fichier || `FEC_${r.annee}.txt`,
        nb_ecritures: Array.isArray(r.ecritures) ? r.ecritures.length : 0
      })))
    }
  }

  const rechargerConnexions = async (uid: string) => {
    try {
      const res = await fetch(`/api/pennylane/connections?user_id=${uid}`)
      if (res.ok) {
        const data = await res.json()
        setPnxConnections(data.connections || [])
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    const charger = async () => {
      setChargement(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/'; return }
        setUserId(user.id)
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('siren, entreprise')
          .eq('user_id', user.id)
          .single()
        if (profile?.siren) {
          const sirenVal = profile.siren as string
          setSirenInput(sirenVal)
          try {
            const res = await fetch('/api/siren?siren=' + sirenVal)
            if (res.ok) { setEntreprise(await res.json()); setSiren(sirenVal) }
            else if (profile.entreprise) { setEntreprise(profile.entreprise as EntrepriseInfo); setSiren(sirenVal) }
          } catch {
            if (profile.entreprise) { setEntreprise(profile.entreprise as EntrepriseInfo); setSiren(sirenVal) }
          }
        }
        await rechargerFec(user.id)
        await rechargerConnexions(user.id)
      } catch (e) { console.error(e) }
      finally { setChargement(false) }
    }
    charger()
  }, [])

  const handleSirenLookup = async (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 9)
    setSirenInput(clean); setSirenError(''); setEntreprise(null)
    if (clean.length !== 9) return
    setSirenLoading(true)
    try {
      const res = await fetch(`/api/siren?siren=${clean}`)
      const data = await res.json()
      if (!res.ok) setSirenError(data.error || 'Entreprise non trouvée')
      else setEntreprise(data)
    } catch { setSirenError('Erreur réseau') }
    finally { setSirenLoading(false) }
  }

  const handleSave = async () => {
    if (!entreprise) return
    setSaving(true)
    try {
      await supabase.from('user_profiles').upsert(
        { user_id: userId, siren: sirenInput, entreprise, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      setSiren(sirenInput); setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const text = await file.text()
      const { lignes, erreur } = parseFEC(text)
      if (erreur) { setUploadMsg(erreur); setUploading(false); return }
      const annee = detectAnnee(lignes, file.name)
      await supabase.from('fec_exercices').upsert(
        { user_id: user.id, annee, ecritures: lignes, nom_fichier: file.name },
        { onConflict: 'user_id,annee' }
      )
      setFecExercices(prev => {
        const filtered = prev.filter(f => f.annee !== annee)
        return [{ annee, nom_fichier: file.name, nb_ecritures: lignes.length }, ...filtered].sort((a,b) => b.annee - a.annee)
      })
      setUploadMsg('FEC ' + annee + ' \u2014 ' + lignes.length.toLocaleString('fr-FR') + ' \u00e9critures import\u00e9es')
    } catch (err) {
      setUploadMsg("Erreur lors de l'import")
      console.error(err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handlePnxConnect = async () => {
    if (!userId) return
    if (!pnxToken.trim()) { setPnxMsg('Erreur : token Pennylane requis'); return }
    setPnxConnecting(true); setPnxMsg('')
    try {
      const res = await fetch('/api/pennylane/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, token: pnxToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setPnxMsg('Erreur : ' + (data.erreur || 'connexion échouée'))
        return
      }
      setPnxMsg(`Dossier ${data.company_name} connecté`)
      setPnxToken('')
      await rechargerConnexions(userId)
    } catch (err) {
      setPnxMsg('Erreur lors de la connexion Pennylane')
      console.error(err)
    } finally {
      setPnxConnecting(false)
    }
  }

  const handlePnxSync = async (connectionId: string) => {
    if (!userId) return
    const annee = pnxSyncAnnee[connectionId] ?? (new Date().getFullYear() - 1)
    setPnxSyncingId(connectionId); setPnxMsg('')
    try {
      const res = await fetch('/api/pennylane/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          connection_id: connectionId,
          period_start: `${annee}-01-01`,
          period_end: `${annee}-12-31`,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setPnxMsg('Erreur : ' + (data.erreur || 'synchronisation échouée'))
        return
      }
      setPnxMsg(`FEC ${data.annee} \u2014 ${data.nb_ecritures.toLocaleString('fr-FR')} \u00e9critures synchronis\u00e9es`)
      await rechargerFec(userId)
    } catch (err) {
      setPnxMsg('Erreur lors de la synchronisation Pennylane')
      console.error(err)
    } finally {
      setPnxSyncingId(null)
    }
  }

  const handlePnxDelete = async (connectionId: string) => {
    if (!userId) return
    setPnxDeletingId(connectionId)
    try {
      const res = await fetch('/api/pennylane/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, connection_id: connectionId }),
      })
      if (res.ok) {
        setPnxConnections(prev => prev.filter(c => c.id !== connectionId))
      }
    } catch (e) { console.error(e) }
    finally { setPnxDeletingId(null) }
  }

  const handleDelete = async (annee: number) => {
    setDeletingAnnee(annee)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('fec_exercices').delete().eq('user_id', user.id).eq('annee', annee)
      setFecExercices(prev => prev.filter(f => f.annee !== annee))
    } catch (e) { console.error(e) }
    finally { setDeletingAnnee(null) }
  }

  if (chargement) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif", alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const lbl = (t: string) => <div style={{ fontSize:10, fontWeight:500, color:'#8C9BAB', textTransform:'uppercase' as const, letterSpacing:'.06em', marginBottom:3 }}>{t}</div>
  const val = (t: string) => <div style={{ fontSize:13, color:'#1A1A1A', fontWeight:500 }}>{t || '—'}</div>

  const anneeCourante = new Date().getFullYear()
  const anneesPnx = [anneeCourante, anneeCourante - 1, anneeCourante - 2, anneeCourante - 3, anneeCourante - 4]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="company"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, position:'sticky' as const, top:0, zIndex:10 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Paramétrages</span>
          {entreprise && <div style={{ fontSize:11, color:'#8C9BAB' }}>SIREN <strong style={{ color:'#1A1A1A' }}>{fmtSiren(siren)}</strong></div>}
        </div>

        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!entreprise ? (
            <div style={{ maxWidth:480, margin:'40px auto', background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:6 }}>Associer votre entreprise</div>
              <div style={{ fontSize:12, color:'#8C9BAB', marginBottom:20 }}>Saisissez votre SIREN pour afficher la fiche légale.</div>
              <label style={{ fontSize:11, fontWeight:600, color:'#5C6670', letterSpacing:'.04em', textTransform:'uppercase' as const, marginBottom:6, display:'block' }}>SIREN</label>
              <input style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, padding:'10px 12px', fontSize:13, fontFamily:'Plus Jakarta Sans,sans-serif', outline:'none', boxSizing:'border-box' as const }}
                type="text" placeholder="9 chiffres" value={sirenInput} onChange={e => handleSirenLookup(e.target.value)} maxLength={9} />
              {sirenLoading && <div style={{ fontSize:11, color:'#B8A98A', marginTop:6 }}>Recherche en cours...</div>}
              {sirenError && <div style={{ fontSize:11, color:'#D85A30', marginTop:6 }}>{sirenError}</div>}
            </div>
          ) : (
            <div style={{ maxWidth:960, display:'flex', flexDirection:'column', gap:16 }}>

              <div style={{ background:'#1A1A1A', borderRadius:12, padding:'18px 24px', display:'flex', alignItems:'center', gap:20 }}>
                <div style={{ width:48, height:48, borderRadius:10, background:'rgba(184,169,138,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ color:'#F2F3F5', fontSize:16, fontWeight:500, marginBottom:3 }}>{entreprise.nom}</div>
                  <div style={{ color:'#8C9BAB', fontSize:11 }}>{entreprise.forme_juridique} · SIREN {fmtSiren(siren)} · {entreprise.ville}</div>
                </div>
                <button onClick={() => { setEntreprise(null); setSirenInput('') }}
                  style={{ background:'transparent', border:'0.5px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'6px 14px', fontSize:11, color:'#8C9BAB', cursor:'pointer' }}>
                  Modifier
                </button>
              </div>

              <div style={{ display:'flex', gap:0, borderBottom:'0.5px solid rgba(0,0,0,0.08)' }}>
                {([['general','Général'], ['fec','Exercices & FEC']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setOnglet(id)}
                    style={{ background:'transparent', border:'none', borderBottom: onglet===id ? '2px solid #B8A98A' : '2px solid transparent', padding:'10px 20px', fontSize:13, fontWeight: onglet===id ? 500 : 400, color: onglet===id ? '#1A1A1A' : '#8C9BAB', cursor:'pointer', transition:'all .15s' }}>
                    {label}
                  </button>
                ))}
              </div>

              {onglet === 'general' && (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A', marginBottom:16 }}>Informations légales</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                      {[
                        ['SIREN', fmtSiren(siren)],
                        ['SIRET siège', fmtSiret(entreprise.siret_siege)],
                        ['Forme juridique', entreprise.forme_juridique],
                        ['Date de création', entreprise.date_creation],
                        ['Code NAF', entreprise.code_naf],
                        ['Activité', entreprise.libelle_naf],
                        ['Effectif', entreprise.tranche_effectif || 'Non renseigné'],
                        ['Capital', entreprise.capital ? new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(entreprise.capital)+' €' : 'Non renseigné'],
                      ].map(([k, v]) => <div key={k}>{lbl(k)}{val(v)}</div>)}
                    </div>
                    <div style={{ marginTop:14 }}>{lbl('Siège social')}{val(entreprise.adresse || `${entreprise.code_postal} ${entreprise.ville}`)}</div>
                  </div>

                  <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A', marginBottom:16 }}>Dirigeants</div>
                    {entreprise.dirigeants.length === 0 ? (
                      <div style={{ fontSize:12, color:'#8C9BAB', fontStyle:'italic' }}>Aucun dirigeant renseigné</div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        {entreprise.dirigeants.map((d, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(184,169,138,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#B8A98A', fontSize:11, fontWeight:500, flexShrink:0 }}>
                              {d.nom.split(' ').map((p:string) => p[0]).join('').slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A' }}>{d.nom}</div>
                              <div style={{ fontSize:11, color:'#8C9BAB' }}>{d.fonction || 'Dirigeant'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {fecExercices.length > 0 && (
                  <>
                    <div style={{ fontSize:10, fontWeight:500, color:'#8C9BAB', textTransform:'uppercase' as const, letterSpacing:'.08em' }}>
                      Synthèse financière — {fecExercices.map(f => f.annee).join(' · ')}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(fecExercices.length,3)},1fr)`, gap:14 }}>
                      {fecExercices.map(ex => {
                        const kpis = exKpis[ex.annee]
                        if (!kpis) return null
                        return (
                          <div key={ex.annee} style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', borderTop:'3px solid #B8A98A', padding:'18px 20px' }}>
                            <div style={{ fontSize:12, fontWeight:500, color:'#8C9BAB', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span>Exercice {ex.annee}</span>
                              <span style={{ fontSize:10, background:'rgba(184,169,138,0.1)', color:'#B8A98A', padding:'2px 8px', borderRadius:4 }}>FEC importé</span>
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                              {[
                                { label:"Chiffre d'affaires", value:new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Math.round(kpis.ca))+' €', accent:'#B8A98A' },
                                { label:'Marge brute', value:`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Math.round(kpis.mb))+' €'} (${(Math.round(kpis.tauxMb*10)/10).toFixed(1)} %)`, accent:'#B8A98A' },
                                { label:'EBITDA', value:`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Math.round(kpis.ebe))+' €'} (${(Math.round(kpis.tauxEbe*10)/10).toFixed(1)} %)`, accent:kpis.tauxEbe>=10?'#1D9E75':'#D85A30' },
                                { label:'Résultat net', value:new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Math.round(kpis.rnet))+' €', accent:kpis.rnet>=0?'#1D9E75':'#D85A30' },
                                { label:'Trésorerie', value:new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Math.round(kpis.treso))+' €', accent:kpis.treso>=0?'#1D9E75':'#D85A30' },
                              ].map(({label,value,accent}) => (
                                <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', paddingBottom:8, borderBottom:'0.5px solid rgba(0,0,0,0.04)' }}>
                                  <span style={{ fontSize:11, color:'#8C9BAB' }}>{label}</span>
                                  <span style={{ fontSize:13, fontWeight:500, color:accent }}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
                </div>
              )}

              {onglet === 'fec' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

                  {/* ── Bloc Pennylane ── */}
                  <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                      <div style={{ width:28, height:28, borderRadius:7, background:'rgba(0,153,118,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#009976" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A' }}>Connexion Pennylane</div>
                        <div style={{ fontSize:11, color:'#8C9BAB' }}>Connectez un dossier puis synchronisez ses exercices en un clic.</div>
                      </div>
                    </div>

                    {/* Liste des connexions existantes */}
                    {pnxConnections.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                        {pnxConnections.map(conn => (
                          <div key={conn.id} style={{ border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' as const }}>
                            <div style={{ flex:'1 1 180px', minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A' }}>{conn.company_name}</div>
                              <div style={{ fontSize:11, color:'#8C9BAB' }}>SIREN {conn.company_reg_no ? fmtSiren(conn.company_reg_no) : '—'}</div>
                            </div>
                            <select
                              value={pnxSyncAnnee[conn.id] ?? (anneeCourante - 1)}
                              onChange={e => setPnxSyncAnnee(prev => ({ ...prev, [conn.id]: parseInt(e.target.value) }))}
                              disabled={pnxSyncingId === conn.id}
                              style={{ flex:'0 0 100px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, padding:'7px 10px', fontSize:13, fontFamily:'Plus Jakarta Sans,sans-serif', outline:'none', background:'#fff', cursor:'pointer' }}
                            >
                              {anneesPnx.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <button
                              onClick={() => handlePnxSync(conn.id)}
                              disabled={pnxSyncingId === conn.id}
                              style={{ flex:'0 0 auto', background: pnxSyncingId === conn.id ? 'rgba(0,153,118,0.4)' : '#009976', color:'#fff', border:'none', borderRadius:8, padding:'7px 16px', fontSize:12, fontWeight:500, cursor: pnxSyncingId === conn.id ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap' as const }}
                            >
                              {pnxSyncingId === conn.id ? (
                                <>
                                  <div style={{ width:11, height:11, border:'1.5px solid rgba(255,255,255,0.3)', borderTop:'1.5px solid #fff', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
                                  Sync...
                                </>
                              ) : 'Synchroniser'}
                            </button>
                            <button
                              onClick={() => handlePnxDelete(conn.id)}
                              disabled={pnxDeletingId === conn.id}
                              style={{ flex:'0 0 auto', background:'transparent', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:8, padding:'7px 12px', fontSize:12, color: pnxDeletingId === conn.id ? '#B4B2A9' : '#D85A30', cursor:'pointer' }}
                            >
                              {pnxDeletingId === conn.id ? '...' : 'Déconnecter'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ajout d'une connexion */}
                    <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' as const }}>
                      <div style={{ flex:'1 1 280px', minWidth:0 }}>
                        <label style={{ fontSize:10, fontWeight:500, color:'#8C9BAB', textTransform:'uppercase' as const, letterSpacing:'.06em', marginBottom:5, display:'block' }}>
                          {pnxConnections.length > 0 ? 'Connecter un autre dossier' : 'Token API Pennylane'}
                        </label>
                        <input
                          type="password"
                          placeholder="Collez votre token Pennylane"
                          value={pnxToken}
                          onChange={e => setPnxToken(e.target.value)}
                          disabled={pnxConnecting}
                          style={{ width:'100%', border:'1px solid rgba(0,0,0,0.12)', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'Plus Jakarta Sans,sans-serif', outline:'none', boxSizing:'border-box' as const }}
                        />
                      </div>
                      <button
                        onClick={handlePnxConnect}
                        disabled={pnxConnecting || !pnxToken.trim()}
                        style={{ flex:'0 0 auto', background: pnxConnecting || !pnxToken.trim() ? 'rgba(26,26,26,0.4)' : '#1A1A1A', color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', fontSize:13, fontWeight:500, cursor: pnxConnecting || !pnxToken.trim() ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap' as const }}
                      >
                        {pnxConnecting ? (
                          <>
                            <div style={{ width:12, height:12, border:'1.5px solid rgba(255,255,255,0.3)', borderTop:'1.5px solid #fff', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
                            Connexion...
                          </>
                        ) : 'Connecter'}
                      </button>
                    </div>

                    {pnxMsg && (
                      <div style={{ marginTop:14, background: pnxMsg.includes('Erreur') ? 'rgba(216,90,48,0.06)' : 'rgba(29,158,117,0.06)', border: `0.5px solid ${pnxMsg.includes('Erreur') ? 'rgba(216,90,48,0.2)' : 'rgba(29,158,117,0.2)'}`, borderRadius:8, padding:'10px 14px', fontSize:12, color: pnxMsg.includes('Erreur') ? '#D85A30' : '#1D9E75' }}>
                        {pnxMsg}
                      </div>
                    )}
                  </div>

                  {/* ── Bloc import manuel + liste des exercices ── */}
                  <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A', marginBottom:2 }}>Fichiers FEC importés</div>
                        <div style={{ fontSize:11, color:'#8C9BAB' }}>{fecExercices.length} exercice{fecExercices.length > 1 ? 's' : ''} disponible{fecExercices.length > 1 ? 's' : ''}</div>
                      </div>
                      <label style={{ background:'#1A1A1A', color:'#F2F3F5', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                        {uploading ? (
                          <>
                            <div style={{ width:12, height:12, border:'1.5px solid rgba(255,255,255,0.3)', borderTop:'1.5px solid #fff', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
                            Import en cours...
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Importer un FEC
                          </>
                        )}
                        <input type="file" accept=".txt,.csv" onChange={handleUpload} style={{ display:'none' }} disabled={uploading} />
                      </label>
                    </div>

                    {uploadMsg && (
                      <div style={{ background: uploadMsg.includes('Erreur') ? 'rgba(216,90,48,0.06)' : 'rgba(29,158,117,0.06)', border: `0.5px solid ${uploadMsg.includes('Erreur') ? 'rgba(216,90,48,0.2)' : 'rgba(29,158,117,0.2)'}`, borderRadius:8, padding:'10px 14px', fontSize:12, color: uploadMsg.includes('Erreur') ? '#D85A30' : '#1D9E75', marginBottom:14 }}>
                        {uploadMsg}
                      </div>
                    )}

                    {fecExercices.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'32px 0', color:'#8C9BAB' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D0CEC8" strokeWidth="1.2" style={{ marginBottom:10, display:'block', margin:'0 auto 10px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div style={{ fontSize:13, color:'#1A1A1A', marginBottom:4 }}>Aucun FEC importé</div>
                        <div style={{ fontSize:12 }}>Importez un fichier FEC ou synchronisez depuis Pennylane.</div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                        <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 140px 100px', padding:'6px 12px', borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}>
                          {['Exercice', 'Fichier', 'Écritures', ''].map(h => (
                            <div key={h} style={{ fontSize:9, fontWeight:500, color:'#B4B2A9', textTransform:'uppercase' as const, letterSpacing:'.08em' }}>{h}</div>
                          ))}
                        </div>
                        {fecExercices.map(f => (
                          <div key={f.annee} style={{ display:'grid', gridTemplateColumns:'80px 1fr 140px 100px', padding:'11px 12px', borderBottom:'0.5px solid rgba(0,0,0,0.04)', alignItems:'center' }}>
                            <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A' }}>{f.annee}</div>
                            <div style={{ fontSize:12, color:'#8C9BAB', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{f.nom_fichier}</div>
                            <div style={{ fontSize:12, color:'#8C9BAB' }}>{f.nb_ecritures.toLocaleString('fr-FR')} lignes</div>
                            <div style={{ display:'flex', justifyContent:'flex-end' }}>
                              <button onClick={() => handleDelete(f.annee)} disabled={deletingAnnee === f.annee}
                                style={{ background:'transparent', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:6, padding:'4px 10px', fontSize:11, color: deletingAnnee===f.annee ? '#B4B2A9' : '#D85A30', cursor:'pointer' }}>
                                {deletingAnnee === f.annee ? '...' : 'Supprimer'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {sirenInput !== siren && entreprise && (
                <button onClick={handleSave} disabled={saving}
                  style={{ background: saved ? '#1D9E75' : '#1A1A1A', color:'#fff', border:'none', borderRadius:8, padding:11, fontSize:13, fontWeight:500, cursor:'pointer' }}>
                  {saving ? 'Enregistrement...' : saved ? 'Enregistré ✓' : 'Enregistrer les modifications'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
