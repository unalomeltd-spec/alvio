'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import AlvioInsight from '@/components/AlvioInsight'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

function CrRow({ label, value, indent, bold, color }: { label: string; value: number; indent?: boolean; bold?: boolean; color?: string }) {
  if (Math.abs(value) < 0.5) return null
  const c = color || (value >= 0 ? '#1A1A1A' : '#D85A30')
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'7px 16px', borderTop:'0.5px solid rgba(0,0,0,0.04)' }}>
      <div style={{ flex:1, fontSize:12, fontWeight: bold ? 500 : 400, color:'#1A1A1A', paddingLeft: indent ? 20 : 0 }}>{label}</div>
      <div style={{ fontSize:12, fontWeight: bold ? 500 : 400, color: c, minWidth:110, textAlign:'right' }}>{fmt(value)}</div>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(184,169,138,0.06)', cursor:'pointer', borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
        <div style={{ flex:1, fontSize:12, fontWeight:500, color:'#1A1A1A', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:9, color:'#B8A98A', display:'inline-block', transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          {title}
        </div>
      </div>
      {open && children}
    </div>
  )
}

function SubTotal({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color || (value >= 0 ? '#1D9E75' : '#D85A30')
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(0,0,0,0.02)', borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
      <div style={{ flex:1, fontSize:12, fontWeight:500, color: c }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:500, color: c, minWidth:110, textAlign:'right' }}>{fmt(value)}</div>
    </div>
  )
}

export default function IncomeStatementPage() {
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

  const cr = etats?.cr
  const sig = etats?.sig

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="income-statement"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="income-statement"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0, position:'sticky' as const, top:0, zIndex:10 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Compte de résultat</span>
          {annees.length > 1 && annees.map(a => (
            <button key={a} onClick={() => changerAnnee(a)} style={{ fontSize:12, fontWeight:500, padding:'4px 10px', borderRadius:6, border:'0.5px solid rgba(0,0,0,0.12)', background: a === anneeActive ? '#1A1A1A' : '#fff', color: a === anneeActive ? '#fff' : '#1A1A1A', cursor:'pointer' }}>{a}</button>
          ))}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!cr ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:900 }}>
              {sig && <AlvioInsight payload={{ page:'income-statement', annee:anneeActive, indicateurs:{ ca:sig.ca, mb:sig.margeCommerciale, rex:sig.rex, rnet:sig.resultatNet, rfin:sig.rfin, tauxMb:sig.tauxMb, tauxRnet:sig.tauxRnet } }} />}
              <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                <div style={{ display:'flex', background:'#1A1A1A', padding:'10px 16px' }}>
                  <div style={{ flex:1, fontSize:11, fontWeight:500, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.06em' }}>Libellé</div>
                  <div style={{ fontSize:11, fontWeight:500, color:'#F2F3F5', minWidth:110, textAlign:'right' }}>N — {anneeActive}</div>
                </div>

                <Section title="Produits d'exploitation">
                  <CrRow label="Ventes de marchandises" value={cr.produitsExploitation.ventesMarchandises} indent />
                  <CrRow label="Production vendue (biens et services)" value={cr.produitsExploitation.productionVendue} indent />
                  <CrRow label="Production stockée" value={cr.produitsExploitation.productionStockee} indent />
                  <CrRow label="Production immobilisée" value={cr.produitsExploitation.productionImmobilisee} indent />
                  <CrRow label="Subventions d'exploitation" value={cr.produitsExploitation.subventions} indent />
                  <CrRow label="Autres produits de gestion courante" value={cr.produitsExploitation.autresProduits} indent />
                  <CrRow label="Reprises sur provisions" value={cr.produitsExploitation.reprises} indent />
                  <SubTotal label="Total produits d'exploitation" value={cr.produitsExploitation.total} color="#B8A98A" />
                </Section>

                <Section title="Charges d'exploitation">
                  <CrRow label="Achats de marchandises" value={cr.chargesExploitation.achatsMarchandises} indent />
                  <CrRow label="Variation de stocks marchandises" value={cr.chargesExploitation.variationStocksMarch} indent />
                  <CrRow label="Autres achats et charges externes" value={cr.chargesExploitation.autresAchats} indent />
                  <CrRow label="Services extérieurs (61/62)" value={cr.chargesExploitation.servicesExt} indent />
                  <CrRow label="Impôts, taxes et versements assimilés" value={cr.chargesExploitation.impotsTaxes} indent />
                  <CrRow label="Charges de personnel" value={cr.chargesExploitation.chargesPersonnel} indent />
                  <CrRow label="Dotations aux amortissements et provisions" value={cr.chargesExploitation.dotations} indent />
                  <CrRow label="Autres charges de gestion courante" value={cr.chargesExploitation.autresCharges} indent />
                  <SubTotal label="Total charges d'exploitation" value={cr.chargesExploitation.total} color="#D85A30" />
                </Section>

                <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', background:'rgba(184,169,138,0.08)', borderTop:'0.5px solid rgba(184,169,138,0.2)' }}>
                  <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#1A1A1A' }}>Résultat d'exploitation</div>
                  <div style={{ fontSize:14, fontWeight:500, color: cr.resultatExploitation >= 0 ? '#1D9E75' : '#D85A30', minWidth:110, textAlign:'right' }}>{fmt(cr.resultatExploitation)}</div>
                </div>

                {(Math.abs(cr.resultatFinancier) > 0.5) && (
                  <Section title="Résultat financier" defaultOpen={false}>
                    {sig && <CrRow label="Produits financiers" value={sig.produitsFinanciers} indent />}
                    {sig && <CrRow label="Charges financières" value={-sig.chargesFinancieres} indent />}
                    <SubTotal label="Résultat financier" value={cr.resultatFinancier} />
                  </Section>
                )}

                {(Math.abs(cr.resultatExceptionnel) > 0.5) && (
                  <Section title="Résultat exceptionnel" defaultOpen={false}>
                    {sig && <CrRow label="Produits exceptionnels" value={sig.produitsExcep} indent />}
                    {sig && <CrRow label="Charges exceptionnelles" value={-sig.chargesExcep} indent />}
                    <SubTotal label="Résultat exceptionnel" value={cr.resultatExceptionnel} />
                  </Section>
                )}

                {(Math.abs(cr.participation) > 0.5 || Math.abs(cr.is) > 0.5) && (
                  <Section title="Impôt et participation" defaultOpen={false}>
                    <CrRow label="Participation des salariés" value={cr.participation} indent />
                    <CrRow label="Impôts sur les bénéfices" value={cr.is} indent />
                  </Section>
                )}

                <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A', borderTop:'0.5px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>Résultat net</div>
                  <div style={{ fontSize:14, fontWeight:500, color: cr.resultatNet >= 0 ? '#1D9E75' : '#D85A30', minWidth:110, textAlign:'right' }}>{fmt(cr.resultatNet)}</div>
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
