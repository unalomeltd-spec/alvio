'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'

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

  useEffect(() => {
    const charger = async () => {
      setChargement(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/'; return }
        const meta = user.user_metadata ?? {}
        if (meta.entreprise && meta.siren) {
          const sirenVal = meta.siren as string
          setSirenInput(sirenVal)
          try {
            const res = await fetch('/api/siren?siren=' + sirenVal)
            if (res.ok) { setEntreprise(await res.json()); setSiren(sirenVal) }
            else { setEntreprise(meta.entreprise as EntrepriseInfo); setSiren(sirenVal) }
          } catch { setEntreprise(meta.entreprise as EntrepriseInfo); setSiren(sirenVal) }
        }
        const { data: fecData } = await supabase
          .from('fec_exercices').select('annee, nom_fichier, ecritures')
          .eq('user_id', user.id).order('annee', { ascending: false })
        if (fecData) {
          const kpisMap: Record<number,any> = {}
          for (const r of fecData) {
            const l = r.ecritures as Array<{CompteNum:string;Debit:number;Credit:number}>
            const s = (ps:string[]) => { let t=0; for(const x of l) for(const p of ps) if(x.CompteNum.startsWith(p)){t+=x.Debit-x.Credit;break}; return t }
            const ca = -s(['701','702','703','704','705','706','707','708'])
            const mb = ca - s(['601','602','603','604','605','606','607','608','609','61','62'])
            const ebe = mb - s(['63']) - s(['64'])
            const rnet = ebe - s(['681','686','687']) + (-s(['76']))-s(['66']) + (-s(['77']))-s(['67']) - s(['695','696','697','698','699'])
            const treso = s(['512','530'])
            kpisMap[r.annee] = { ca, mb, tauxMb:ca>0?mb/ca*100:0, ebe, tauxEbe:ca>0?ebe/ca*100:0, rnet, treso }
          }
          setExKpis(kpisMap)
          setFecExercices(fecData.map(r => ({
            annee: r.annee,
            nom_fichier: r.nom_fichier || `FEC_${r.annee}.txt`,
            nb_ecritures: Array.isArray(r.ecritures) ? r.ecritures.length : 0
          })))
        }
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
      await supabase.auth.updateUser({ data: { siren: sirenInput, entreprise } })
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
      const lines = text.split('\n').filter(l => l.trim())
      const header = lines[0].split(/[;\t|]/).map(h => h.trim().replace(/"/g, ''))
      const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : '|'
      const getIdx = (names: string[]) => { for (const n of names) { const i = header.findIndex(h => h.toLowerCase().includes(n.toLowerCase())); if (i >= 0) return i } return -1 }
      const iDate = getIdx(['EcritureDate','ecrituredate','date'])
      const iCompte = getIdx(['CompteNum','comptenum','compte'])
      const iDebit = getIdx(['Debit','debit','montantdebit'])
      const iCredit = getIdx(['Credit','credit','montantcredit'])
      if (iDate < 0 || iCompte < 0) { setUploadMsg('Format FEC non reconnu'); setUploading(false); return }
      const lignes = lines.slice(1).map(l => {
        const cols = l.split(sep).map(c => c.trim().replace(/"/g, ''))
        const debit = parseFloat(cols[iDebit]?.replace(',', '.') || '0') || 0
        const credit = parseFloat(cols[iCredit]?.replace(',', '.') || '0') || 0
        return { EcritureDate: cols[iDate] || '', CompteNum: cols[iCompte] || '', Debit: debit, Credit: credit }
      }).filter(l => l.CompteNum)
      const dateStr = lignes.find(l => l.EcritureDate)?.EcritureDate || ''
      const annee = dateStr.length >= 4 ? parseInt(dateStr.includes('-') ? dateStr.slice(0,4) : dateStr.slice(4,8) || dateStr.slice(0,4)) : new Date().getFullYear()
      await supabase.from('fec_exercices').upsert({ user_id: user.id, annee, ecritures: lignes, nom_fichier: file.name }, { onConflict: 'user_id,annee' })
      setFecExercices(prev => {
        const filtered = prev.filter(f => f.annee !== annee)
        return [{ annee, nom_fichier: file.name, nb_ecritures: lignes.length }, ...filtered].sort((a,b) => b.annee - a.annee)
      })
      setUploadMsg(`FEC ${annee} importé — ${lignes.length.toLocaleString('fr-FR')} écritures`)
    } catch (err) { setUploadMsg('Erreur lors de l\'import'); console.error(err) }
    finally { setUploading(false); e.target.value = '' }
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
                        <div style={{ fontSize:12 }}>Importez votre premier fichier FEC pour commencer l'analyse.</div>
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
