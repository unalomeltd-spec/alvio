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

function decalerAnMoins1(d: string): string {
  if (!d) return ''
  const y = parseInt(d.slice(0,4), 10)
  return (y - 1) + d.slice(4)
}

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)
  return d
}

function formatCompte(num: string): string {
  if (num.length >= 8) return num.slice(0, 8)
  return num.padEnd(8, '0')
}

// getSousComptes et soldePCG importés depuis usePCG — sans double comptage
function soldeGroupe(lignes: LigneFEC[], groupeKey: string, pcg: PCGGroupe, index: PCGIndex): number {
  return soldePCG(lignes, groupeKey, pcg, index)
}

interface PanelData { compte: string; label: string; valeur: number; ecritures: LigneFEC[] }

function SidePanel({ data, onClose }: { data: PanelData; onClose: () => void }) {
  const fmtDate = (d: string) => { const iso = toIso(d); if (!iso) return d; return iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4) }
  return (
    <div style={{ width:300, flexShrink:0, background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 120px)', position:'fixed' as const, top:80, right:24, zIndex:100 }}>
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

function CrRow({ label, groupeKeys, lignes, lignesN1, panelData, setPanelData, color, bold, indent, sub, isTotal, pcg, index }: {
  label: string; groupeKeys: string[]; lignes: LigneFEC[]; lignesN1?: LigneFEC[]
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
  color?: string; bold?: boolean; indent?: boolean; sub?: boolean; isTotal?: boolean
  pcg: PCGGroupe; index: PCGIndex
}) {
  const [open, setOpen] = useState(false)
  const sousComptes = useMemo(() => {
    return getSousComptes(lignes, groupeKeys, pcg, index)
  }, [lignes, groupeKeys, pcg, index])

  const valeur = sousComptes.reduce((s, c) => s + c.valeur, 0)
  const valeurN1 = lignesN1 ? getSousComptes(lignesN1, groupeKeys, pcg, index).reduce((s, c) => s + c.valeur, 0) : null
  if (Math.abs(valeur) < 0.5 && !isTotal) return null

  const hasDetail = sousComptes.length > 0
  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1
  const c = color || (valeur >= 0 ? '#1A1A1A' : '#D85A30')

  if (isTotal) return (
    <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A', borderTop:'0.5px solid rgba(255,255,255,0.1)' }}>
      <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:500, color: valeur >= 0 ? '#1D9E75' : '#D85A30', minWidth:110, textAlign:'right' }}>{fmt(valeur)}</div>
      <div style={{ fontSize:10, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>{fmtP(valeur)}</div>
    </div>
  )

  if (sub) return (
    <>
      <div onClick={() => hasDetail && setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(0,0,0,0.02)', borderTop:'0.5px solid rgba(0,0,0,0.06)', cursor: hasDetail ? 'pointer' : 'default' }}>
        <div style={{ flex:1, fontSize:12, fontWeight:500, color: c, display:'flex', alignItems:'center', gap:6 }}>
          {hasDetail && <span style={{ fontSize:9, color:'#B8A98A', transition:'transform 0.2s', display:'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>}
          {label}
        </div>
        <div style={{ fontSize:13, fontWeight:500, color: c, minWidth:110, textAlign:'right' }}>{fmt(valeur)}</div>
        <div style={{ fontSize:12, color:'#8C9BAB', minWidth:110, textAlign:'right' }}>{valeurN1 !== null ? fmt(valeurN1) : '—'}</div>
        <div style={{ fontSize:10, fontWeight:500, minWidth:60, textAlign:'right', color: valeurN1 && valeurN1 !== 0 ? ((valeur - valeurN1)/Math.abs(valeurN1)*100 >= 0 ? '#1D9E75' : '#D85A30') : '#8C9BAB' }}>{valeurN1 && valeurN1 !== 0 ? ((valeur - valeurN1)/Math.abs(valeurN1)*100).toFixed(1)+'%' : '—'}</div>
      </div>
      {open && sousComptes.length > 0 && (
        <div style={{ margin:'0 0 2px 0', background:'#fff', border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
          {sousComptes.map((sc, i) => {
            const pctBar = Math.abs(sc.valeur) / maxVal * 100
            const active = panelData?.compte === sc.prefix
            return (
              <div key={i} onClick={() => setPanelData(active ? null : { compte: sc.prefix, label: sc.label, valeur: sc.valeur, ecritures: sc.ecritures })}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderBottom: i < sousComptes.length-1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', cursor:'pointer', background: active ? 'rgba(184,169,138,0.08)' : 'transparent', transition:'background 0.1s' }}>
                <span style={{ fontSize:11, fontWeight:600, color:'#B8A98A', minWidth:70, fontFamily:'monospace' }}>{formatCompte(sc.prefix)}</span>
                <span style={{ flex:1, fontSize:12, color:'#1A1A1A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sc.label}</span>
                <div style={{ width:50, height:4, background:'rgba(0,0,0,0.06)', borderRadius:2, flexShrink:0 }}>
                  <div style={{ height:'100%', width:`${pctBar}%`, background: sc.valeur >= 0 ? '#D85A30' : '#1D9E75', borderRadius:2 }} />
                </div>
                <span style={{ fontSize:12, fontWeight:500, color: sc.valeur >= 0 ? '#D85A30' : '#1D9E75', minWidth:90, textAlign:'right' }}>{fmt(Math.abs(sc.valeur))}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  return (
    <>
      <div onClick={() => hasDetail && setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', padding:'7px 16px', background:'transparent', borderTop:'0.5px solid rgba(0,0,0,0.04)', cursor: hasDetail ? 'pointer' : 'default' }}
        onMouseEnter={e => { if (hasDetail) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
        <div style={{ flex:1, fontSize:12, fontWeight: bold ? 500 : 400, color: (color as any) || '#1A1A1A', paddingLeft: indent ? 20 : 0, display:'flex', alignItems:'center', gap:6 }}>
          {hasDetail && <span style={{ fontSize:9, color:'#B8A98A', transition:'transform 0.2s', display:'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>}
          {label}
        </div>
        <div style={{ fontSize:12, fontWeight: bold ? 500 : 400, color: c, minWidth:110, textAlign:'right' }}>{fmt(valeur)}</div>
        <div style={{ fontSize:11, color:'#B4B2A9', minWidth:110, textAlign:'right' }}>{valeurN1 !== null ? fmt(valeurN1) : ''}</div>
        <div style={{ fontSize:10, fontWeight:500, minWidth:60, textAlign:'right', color: valeurN1 && valeurN1 !== 0 ? ((valeur - valeurN1)/Math.abs(valeurN1)*100 >= 0 ? '#1D9E75' : '#D85A30') : '#8C9BAB' }}>{valeurN1 && valeurN1 !== 0 ? ((valeur - valeurN1)/Math.abs(valeurN1)*100).toFixed(1)+'%' : '—'}</div>
      </div>
      {open && sousComptes.length > 0 && (
        <div style={{ margin:'0 0 2px 16px', background:'#fff', border:'0.5px solid rgba(0,0,0,0.06)', borderRadius:6, overflow:'hidden' }}>
          {sousComptes.map((sc, i) => {
            const pctBar = Math.abs(sc.valeur) / maxVal * 100
            const active = panelData?.compte === sc.prefix
            return (
              <div key={i} onClick={() => setPanelData(active ? null : { compte: sc.prefix, label: sc.label, valeur: sc.valeur, ecritures: sc.ecritures })}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', borderBottom: i < sousComptes.length-1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', cursor:'pointer', background: active ? 'rgba(184,169,138,0.08)' : 'transparent', transition:'background 0.1s' }}>
                <span style={{ fontSize:11, fontWeight:600, color:'#B8A98A', minWidth:70, fontFamily:'monospace' }}>{formatCompte(sc.prefix)}</span>
                <span style={{ flex:1, fontSize:12, color:'#1A1A1A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sc.label}</span>
                <div style={{ width:50, height:4, background:'rgba(0,0,0,0.06)', borderRadius:2, flexShrink:0 }}>
                  <div style={{ height:'100%', width:`${pctBar}%`, background: sc.valeur >= 0 ? '#D85A30' : '#1D9E75', borderRadius:2 }} />
                </div>
                <span style={{ fontSize:12, fontWeight:500, color: sc.valeur >= 0 ? '#D85A30' : '#1D9E75', minWidth:90, textAlign:'right' }}>{fmt(Math.abs(sc.valeur))}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
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

export default function IncomeStatementPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [typePcg, setTypePcg] = useState<'classique'|'asso'>('classique')
  const [panelData, setPanelData] = useState<PanelData | null>(null)
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

  const pcg = mappings?.sig ?? {}
  const index = mappings?.sigIndex
  const hasPCG = Object.keys(pcg).length > 0 && !!index
  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)

  const indBase = useMemo(() => {
    if (!lignesActives.length || !hasPCG) return null
    const s = (key: string) => soldePCG(lignesActives, key, pcg, index!)
    const ca = s('productionVendue') + s('ventesMarchandises')
    const mb = s('ventesMarchandises') - s('coutMarchandises')
    const va = mb + s('productionVendue') + s('productionStockee') + s('productionImmobilisee') - s('consommationsIntermediaires')
    const ebe = va + s('subventions') - s('impotsTaxes') - s('chargesPersonnel')
    const rex = ebe - s('dotations') + s('reprises') + s('transfertsCharges') + s('autresProduits') - s('autresCharges')
    const rfin = s('produitsFinanciers') - s('chargesFinancieres')
    const rnet = rex + rfin + s('produitsExceptionnels') - s('chargesExceptionnelles') - s('participation') - s('is')
    return { ca, rnet, rex, rfin, mb, tauxMb: ca>0?mb/ca*100:0, tauxRnet: ca>0?rnet/ca*100:0 }
  }, [lignesActives, pcg, index])

  const indN1 = useMemo(() => {
    if (!lignesN1.length || !hasPCG) return null
    const s = (key: string) => soldePCG(lignesN1, key, pcg, index!)
    const ca = s('productionVendue') + s('ventesMarchandises')
    const mb = s('ventesMarchandises') - s('coutMarchandises')
    const va = mb + s('productionVendue') + s('productionStockee') + s('productionImmobilisee') - s('consommationsIntermediaires')
    const ebe = va + s('subventions') - s('impotsTaxes') - s('chargesPersonnel')
    const rex = ebe - s('dotations') + s('reprises') + s('transfertsCharges') + s('autresProduits') - s('autresCharges')
    const rfin = s('produitsFinanciers') - s('chargesFinancieres')
    const rnet = rex + rfin + s('produitsExceptionnels') - s('chargesExceptionnelles') - s('participation') - s('is')
    return { ca, rnet, rex, rfin, mb, tauxMb: ca>0?mb/ca*100:0, tauxRnet: ca>0?rnet/ca*100:0 }
  }, [lignesN1, pcg, index])

  const rowProps = { lignes: lignesActives, lignesN1, panelData, setPanelData, pcg, index: index! }
  const totalRnet = indBase?.rnet ?? 0
  const totalCa = indBase?.ca ?? 0

  if (loading || pcgLoading) return (
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
          {indBase && <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive} periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} anneeN1={anneeN1} setAnneeN1={setAnneeN1} dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1} dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!indBase ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ display:'flex', gap:16, alignItems:'flex-start', maxWidth:1200 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <AlvioInsight payload={{ page:'income-statement', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ ca:indBase.ca, mb:indBase.mb, rex:indBase.rex, rnet:indBase.rnet, rfin:indBase.rfin, tauxMb:indBase.tauxMb, tauxRnet:indBase.tauxRnet } }} />
                <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                  <div style={{ display:'flex', background:'#1A1A1A', padding:'10px 16px' }}>
                    <div style={{ flex:1, fontSize:11, fontWeight:500, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.06em' }}>Libellé</div>
                    <div style={{ fontSize:11, fontWeight:500, color:'#F2F3F5', minWidth:110, textAlign:'right' }}>N — {periodeTab==='perso'&&dateDebut?dateDebut.slice(0,4):anneeActive}</div>
                    <div style={{ fontSize:11, color:'#B8A98A', minWidth:110, textAlign:'right' }}>N-1 — {periodeTab==='perso'&&dateDebut?(parseInt(dateDebut.slice(0,4))-1):anneeActive-1}</div>
                    <div style={{ fontSize:11, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>Variation</div>
                  </div>

                  <Section title="Produits d'exploitation" defaultOpen={true}>
                    <CrRow label="Ventes de marchandises" groupeKeys={['ventesMarchandises']} {...rowProps} indent />
                    <CrRow label="Production vendue (biens et services)" groupeKeys={['productionVendue']} {...rowProps} indent />
                    <CrRow label="Production stockée" groupeKeys={['productionStockee']} {...rowProps} indent />
                    <CrRow label="Production immobilisée" groupeKeys={['productionImmobilisee']} {...rowProps} indent />
                    <CrRow label="Subventions d'exploitation" groupeKeys={['subventions']} {...rowProps} indent />
                    <CrRow label="Autres produits de gestion courante" groupeKeys={['autresProduits']} {...rowProps} indent />
                    <CrRow label="Reprises sur prov. et transferts de charges" groupeKeys={['reprises','transfertsCharges']} {...rowProps} indent />
                    <CrRow label="Total produits d'exploitation" groupeKeys={['ventesMarchandises','productionVendue','productionStockee','productionImmobilisee','subventions','autresProduits','reprises','transfertsCharges']} {...rowProps} sub color="#B8A98A" />
                  </Section>

                  <Section title="Charges d'exploitation" defaultOpen={true}>
                    <CrRow label="Achats de marchandises" groupeKeys={['coutMarchandises']} {...rowProps} indent />
                    <CrRow label="Consommations externes (matières, services)" groupeKeys={['consommationsIntermediaires']} {...rowProps} indent />
                    <CrRow label="Impôts, taxes et versements assimilés" groupeKeys={['impotsTaxes']} {...rowProps} indent />
                    <CrRow label="Charges de personnel" groupeKeys={['chargesPersonnel']} {...rowProps} indent />
                    <CrRow label="Dotations aux amortissements et provisions" groupeKeys={['dotations']} {...rowProps} indent />
                    <CrRow label="Autres charges de gestion courante" groupeKeys={['autresCharges']} {...rowProps} indent />
                    <CrRow label="Total charges d'exploitation" groupeKeys={['coutMarchandises','consommationsIntermediaires','impotsTaxes','chargesPersonnel','dotations','autresCharges']} {...rowProps} sub color="#D85A30" />
                  </Section>

                  <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', background:'rgba(184,169,138,0.08)', borderTop:'0.5px solid rgba(184,169,138,0.2)' }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#1A1A1A' }}>Résultat d'exploitation</div>
                    <div style={{ fontSize:14, fontWeight:500, color: indBase.rex >= 0 ? '#1D9E75' : '#D85A30', minWidth:110, textAlign:'right' }}>{fmt(indBase.rex)}</div>
                    <div style={{ fontSize:12, color:'#8C9BAB', minWidth:110, textAlign:'right' }}>{indN1 ? fmt(indN1.rex) : '—'}</div>
                    <div style={{ fontSize:10, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>{fmtP(indBase.ca > 0 ? indBase.rex/indBase.ca*100 : 0)}</div>
                  </div>

                  {(Math.abs(soldeGroupe(lignesActives,'produitsFinanciers',pcg,index!)) > 0.5 || Math.abs(soldeGroupe(lignesActives,'chargesFinancieres',pcg,index!)) > 0.5) && (
                    <Section title="Résultat financier">
                      <CrRow label="Produits financiers" groupeKeys={['produitsFinanciers']} {...rowProps} indent />
                      <CrRow label="Charges financières" groupeKeys={['chargesFinancieres']} {...rowProps} indent />
                      <CrRow label="Résultat financier" groupeKeys={['produitsFinanciers','chargesFinancieres']} {...rowProps} sub color={indBase.rfin >= 0 ? '#1D9E75' : '#D85A30'} />
                    </Section>
                  )}

                  {(Math.abs(soldeGroupe(lignesActives,'produitsExceptionnels',pcg,index!)) > 0.5 || Math.abs(soldeGroupe(lignesActives,'chargesExceptionnelles',pcg,index!)) > 0.5) && (
                    <Section title="Résultat exceptionnel">
                      <CrRow label="Produits exceptionnels" groupeKeys={['produitsExceptionnels']} {...rowProps} indent />
                      <CrRow label="Charges exceptionnelles" groupeKeys={['chargesExceptionnelles']} {...rowProps} indent />
                      <CrRow label="Résultat exceptionnel" groupeKeys={['produitsExceptionnels','chargesExceptionnelles']} {...rowProps} sub color={(soldeGroupe(lignesActives,'produitsExceptionnels',pcg,index!) - soldeGroupe(lignesActives,'chargesExceptionnelles',pcg,index!)) >= 0 ? '#1D9E75' : '#D85A30'} />
                    </Section>
                  )}

                  {(Math.abs(soldeGroupe(lignesActives,'participation',pcg,index!)) > 0.5 || Math.abs(soldeGroupe(lignesActives,'is',pcg,index!)) > 0.5) && (
                    <Section title="Impôt et participation">
                      <CrRow label="Participation des salariés" groupeKeys={['participation']} {...rowProps} indent />
                      <CrRow label="Impôts sur les bénéfices" groupeKeys={['is']} {...rowProps} indent />
                    </Section>
                  )}

                  <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A', borderTop:'0.5px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>Résultat net</div>
                    <div style={{ fontSize:14, fontWeight:500, color: totalRnet >= 0 ? '#1D9E75' : '#D85A30', minWidth:110, textAlign:'right' }}>{fmt(totalRnet)}</div>
                    <div style={{ fontSize:10, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>{fmtP(totalCa > 0 ? totalRnet/totalCa*100 : 0)}</div>
                  </div>
                </div>
              </div>
              {panelData && <SidePanel data={panelData} onClose={() => setPanelData(null)} />}
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
