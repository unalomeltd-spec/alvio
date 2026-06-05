'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import AlvioInsight from '@/components/AlvioInsight'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'

function BilanRow({ label, value, indent, bold, color }: { label: string; value: number; indent?: boolean; bold?: boolean; color?: string }) {
  if (Math.abs(value) < 0.5) return null
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'7px 16px', borderTop:'0.5px solid rgba(0,0,0,0.04)' }}>
      <div style={{ flex:1, fontSize:12, fontWeight: bold ? 500 : 400, color:'#1A1A1A', paddingLeft: indent ? 20 : 0 }}>{label}</div>
      <div style={{ fontSize:12, fontWeight: bold ? 500 : 400, color: color || '#1A1A1A', minWidth:110, textAlign:'right' }}>{fmt(Math.abs(value))}</div>
    </div>
  )
}

function BilanSection({ title, total, children, color }: { title: string; total: number; children: React.ReactNode; color?: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(184,169,138,0.06)', cursor:'pointer', borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
        <div style={{ flex:1, fontSize:12, fontWeight:500, color:'#1A1A1A', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:9, color:'#B8A98A', display:'inline-block', transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          {title}
        </div>
        <div style={{ fontSize:13, fontWeight:500, color: color || '#B8A98A', minWidth:110, textAlign:'right' }}>{fmt(Math.abs(total))}</div>
      </div>
      {open && children}
    </div>
  )
}

export default function BalanceSheetPage() {
  const [etats, setEtats] = useState<any>(null)
  const [annees, setAnnees] = useState<number[]>([])
  const [anneeActive, setAnneeActive] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUserId(user.id)
      const { data } = await sb.from('fec_exercices').select('annee').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const anneesDispos = data.map((r: any) => r.annee as number)
        setAnnees(anneesDispos)
        const annee = anneesDispos[0]
        setAnneeActive(annee)
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

  const bilan = etats?.bilan
  const sig = etats?.sig
  const actif = bilan?.actif
  const passif = bilan?.passif

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="balance-sheet"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="balance-sheet"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0, position:'sticky' as const, top:0, zIndex:10 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Bilan</span>
          {annees.length > 1 && annees.map(a => (
            <button key={a} onClick={() => changerAnnee(a)} style={{ fontSize:12, fontWeight:500, padding:'4px 10px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.12)', background: a === anneeActive ? '#1A1A1A' : '#fff', color: a === anneeActive ? '#fff' : '#1A1A1A', cursor:'pointer' }}>{a}</button>
          ))}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!bilan ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:1200 }}>
              {sig && <AlvioInsight payload={{ page:'balance-sheet', annee:anneeActive, indicateurs:{ tresorerie: actif?.tresorerie ?? 0, bfr: (actif?.creancesClients ?? 0) - (passif?.dettesFournisseurs ?? 0), totalActif: actif?.totalActif ?? 0, capitauxPropres: passif?.capitauxPropres ?? 0 } }} />}

              {/* Contrôle équilibre */}
              {etats?.controles && (
                <div style={{ background: etats.controles.equilibreBilan ? 'rgba(29,158,117,0.08)' : 'rgba(216,90,48,0.08)', border: `0.5px solid ${etats.controles.equilibreBilan ? 'rgba(29,158,117,0.3)' : 'rgba(216,90,48,0.3)'}`, borderRadius:8, padding:'8px 14px', marginBottom:16, fontSize:12, color: etats.controles.equilibreBilan ? '#1D9E75' : '#D85A30', display:'flex', justifyContent:'space-between' }}>
                  <span>{etats.controles.equilibreBilan ? '✓ Bilan équilibré' : '⚠ Bilan déséquilibré'}</span>
                  <span>Actif {fmt(actif?.totalActif ?? 0)} · Passif {fmt(passif?.totalPassif ?? 0)}</span>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {/* ACTIF */}
                <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                  <div style={{ background:'#1A1A1A', padding:'10px 16px', display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:11, fontWeight:500, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.06em' }}>Actif</span>
                    <span style={{ fontSize:11, fontWeight:500, color:'#B8A98A' }}>{fmt(actif?.totalActif ?? 0)}</span>
                  </div>

                  <BilanSection title="Actif immobilisé" total={actif?.actifImmoNet ?? 0}>
                    <BilanRow label="Immobilisations incorporelles brutes" value={actif?.immoIncorpBrut ?? 0} indent />
                    <BilanRow label="Amortissements incorporels" value={-(actif?.amortIncorp ?? 0)} indent color="#D85A30" />
                    <BilanRow label="Immobilisations corporelles brutes" value={actif?.immoCorpBrut ?? 0} indent />
                    <BilanRow label="Amortissements corporels" value={-(actif?.amortCorp ?? 0)} indent color="#D85A30" />
                    <BilanRow label="Immobilisations financières" value={actif?.immoFinBrut ?? 0} indent />
                    <BilanRow label="Immobilisations nettes" value={actif?.actifImmoNet ?? 0} bold />
                  </BilanSection>

                  <BilanSection title="Actif circulant" total={(actif?.stocksMarchandises ?? 0) + (actif?.creancesClients ?? 0) + (actif?.creancesEtat ?? 0) + (actif?.autresCreances ?? 0) + (actif?.tresorerie ?? 0)}>
                    <BilanRow label="Stocks marchandises" value={actif?.stocksMarchandises ?? 0} indent />
                    <BilanRow label="Stocks matières" value={actif?.stocksMatieres ?? 0} indent />
                    <BilanRow label="Clients et comptes rattachés" value={actif?.creancesClients ?? 0} indent />
                    <BilanRow label="Créances fiscales (État)" value={actif?.creancesEtat ?? 0} indent />
                    <BilanRow label="Autres créances" value={actif?.autresCreances ?? 0} indent />
                    <BilanRow label="Charges constatées d'avance" value={actif?.chargesConstatees ?? 0} indent />
                    <BilanRow label="Disponibilités" value={actif?.tresorerie ?? 0} indent color="#1D9E75" />
                  </BilanSection>

                  <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A' }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>Total actif</div>
                    <div style={{ fontSize:14, fontWeight:500, color:'#B8A98A', minWidth:110, textAlign:'right' }}>{fmt(actif?.totalActif ?? 0)}</div>
                  </div>
                </div>

                {/* PASSIF */}
                <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                  <div style={{ background:'#1A1A1A', padding:'10px 16px', display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:11, fontWeight:500, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.06em' }}>Passif</span>
                    <span style={{ fontSize:11, fontWeight:500, color:'#B8A98A' }}>{fmt(passif?.totalPassif ?? 0)}</span>
                  </div>

                  <BilanSection title="Capitaux propres" total={passif?.capitauxPropres ?? 0} color={( passif?.capitauxPropres ?? 0) >= 0 ? '#1D9E75' : '#D85A30'}>
                    <BilanRow label="Capital et primes d'émission" value={(passif?.capital ?? 0) + (passif?.primes ?? 0)} indent />
                    <BilanRow label="Réserves" value={passif?.reserves ?? 0} indent />
                    <BilanRow label="Report à nouveau" value={passif?.reportNouveau ?? 0} indent />
                    <BilanRow label="Subventions d'investissement" value={passif?.subventionsInvest ?? 0} indent />
                    <BilanRow label="Résultat de l'exercice" value={passif?.resultatNet ?? 0} indent color={( passif?.resultatNet ?? 0) >= 0 ? '#1D9E75' : '#D85A30'} />
                    <BilanRow label="Capitaux propres" value={passif?.capitauxPropres ?? 0} bold color={( passif?.capitauxPropres ?? 0) >= 0 ? '#1D9E75' : '#D85A30'} />
                  </BilanSection>

                  <BilanSection title="Dettes" total={(passif?.empruntsEtablissement ?? 0) + (passif?.autresEmpruntsLT ?? 0) + (passif?.dettesFournisseurs ?? 0) + (passif?.dettesSociales ?? 0) + (passif?.dettesFiscales ?? 0) + (passif?.autresDettes ?? 0)}>
                    <BilanRow label="Emprunts établissements de crédit" value={passif?.empruntsEtablissement ?? 0} indent />
                    <BilanRow label="Autres emprunts et dettes" value={passif?.autresEmpruntsLT ?? 0} indent />
                    <BilanRow label="Fournisseurs et comptes rattachés" value={passif?.dettesFournisseurs ?? 0} indent />
                    <BilanRow label="Dettes sociales (personnel, URSSAF)" value={passif?.dettesSociales ?? 0} indent />
                    <BilanRow label="Dettes fiscales (IS, TVA)" value={passif?.dettesFiscales ?? 0} indent />
                    <BilanRow label="Autres dettes" value={passif?.autresDettes ?? 0} indent />
                    <BilanRow label="Produits constatés d'avance" value={passif?.produitsConstates ?? 0} indent />
                  </BilanSection>

                  <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A' }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>Total passif</div>
                    <div style={{ fontSize:14, fontWeight:500, color:'#B8A98A', minWidth:110, textAlign:'right' }}>{fmt(passif?.totalPassif ?? 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
