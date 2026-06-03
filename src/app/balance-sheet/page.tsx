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

// getSousComptes importé depuis usePCG — sans double comptage
// Tous les soldes sont déjà signés correctement via l'index Supabase
// signe=1 → actif (valeur positive = avoir)
// signe=-1 → passif (valeur positive = ressource/dette)
function soldeKeys(lignes: LigneFEC[], keys: string[], pcg: PCGGroupe, index: PCGIndex): number {
  return getSousComptes(lignes, keys, pcg, index).reduce((s, c) => s + c.valeur, 0)
}
function soldeActif(lignes: LigneFEC[], keys: string[], pcg: PCGGroupe, index: PCGIndex): number {
  return getSousComptes(lignes, keys, pcg, index).reduce((s, c) => s + c.valeur, 0)
}
function soldePassif(lignes: LigneFEC[], keys: string[], pcg: PCGGroupe, index: PCGIndex): number {
  return getSousComptes(lignes, keys, pcg, index).reduce((s, c) => s + c.valeur, 0)
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
            <div style={{ fontSize:22, fontWeight:600, color:'#fff' }}>{fmt(Math.abs(data.valeur))}</div>
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

function renderSousComptes(sousComptes: ReturnType<typeof getSousComptes>, maxVal: number, panelData: PanelData | null, setPanelData: (d: PanelData | null) => void, color?: string) {
  return (
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
              <div style={{ height:'100%', width:`${pctBar}%`, background: color || '#B8A98A', borderRadius:2 }} />
            </div>
            <span style={{ fontSize:12, fontWeight:500, color: color || '#1A1A1A', minWidth:80, textAlign:'right' }}>{fmt(Math.abs(sc.valeur))}</span>
          </div>
        )
      })}
    </div>
  )
}

function BilanLigne({ label, groupeKeys, lignes, panelData, setPanelData, color, indent, bold, isTotal, isSousTotal, filterSign, pcg, index }: {
  label: string; groupeKeys: string[]; lignes: LigneFEC[]
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
  color?: string; indent?: boolean; bold?: boolean; isTotal?: boolean; isSousTotal?: boolean; filterSign?: 'actif' | 'passif'
  pcg: PCGGroupe; index: PCGIndex
}) {
  const [open, setOpen] = useState(false)
  const sousComptesRaw = useMemo(() => getSousComptes(lignes, groupeKeys, pcg, index), [lignes, groupeKeys, pcg, index])
  const sousComptes = sousComptesRaw
  const valeur = sousComptes.reduce((s, c) => s + c.valeur, 0)
  const valeurAbs = Math.abs(valeur)
  const hasDetail = sousComptes.length > 0
  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1
  if (Math.abs(valeur) < 0.5 && !isTotal && !isSousTotal) return null
  const c = color || '#1A1A1A'

  if (isTotal) return (
    <div style={{ display:'flex', alignItems:'center', padding:'11px 16px', background:'#1A1A1A', borderTop:'0.5px solid rgba(255,255,255,0.08)' }}>
      <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:500, color:'#B8A98A' }}>{fmt(valeurAbs)}</div>
    </div>
  )

  if (isSousTotal) return (
    <>
      <div onClick={() => hasDetail && setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(184,169,138,0.06)', borderTop:'0.5px solid rgba(184,169,138,0.15)', cursor: hasDetail ? 'pointer' : 'default' }}>
        <div style={{ flex:1, fontSize:12, fontWeight:500, color: c, display:'flex', alignItems:'center', gap:6 }}>
          {hasDetail && <span style={{ fontSize:9, color:'#B8A98A', transition:'transform 0.2s', display:'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>}
          {label}
        </div>
        <div style={{ fontSize:13, fontWeight:500, color: c }}>{fmt(valeurAbs)}</div>
      </div>
      {open && sousComptes.length > 0 && renderSousComptes(sousComptes, maxVal, panelData, setPanelData, c)}
    </>
  )

  return (
    <>
      <div onClick={() => hasDetail && setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', padding:'7px 16px', borderBottom:'0.5px solid rgba(0,0,0,0.04)', cursor: hasDetail ? 'pointer' : 'default', transition:'background 0.1s' }}
        onMouseEnter={e => { if (hasDetail) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
        <div style={{ flex:1, fontSize:12, fontWeight: bold ? 500 : 400, color:'#1A1A1A', paddingLeft: indent ? 16 : 0, display:'flex', alignItems:'center', gap:6 }}>
          {hasDetail && <span style={{ fontSize:9, color:'#B8A98A', transition:'transform 0.2s', display:'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>}
          {label}
        </div>
        <div style={{ fontSize:12, fontWeight: bold ? 500 : 400, color: c }}>{fmt(valeurAbs)}</div>
      </div>
      {open && sousComptes.length > 0 && renderSousComptes(sousComptes, maxVal, panelData, setPanelData, c)}
    </>
  )
}

function Section({ title, total, color, children, defaultOpen = false }: { title: string; total: number; color?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  if (Math.abs(total) < 0.5) return null
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(0,0,0,0.02)', cursor:'pointer', borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
        <div style={{ flex:1, fontSize:11, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.07em', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:9, color:'#B8A98A', display:'inline-block', transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          {title}
        </div>
        <span style={{ fontSize:12, fontWeight:500, color: color || '#1A1A1A' }}>{fmt(total)}</span>
      </div>
      {open && children}
    </div>
  )
}

export default function BalanceSheetPage() {
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

  const pcg = mappings?.bilan ?? {}
  const index = mappings?.bilanIndex
  const hasPCG = Object.keys(pcg).length > 0 && !!index
  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)
  const rp = { lignes: lignesActives, panelData, setPanelData, pcg, index: index! }

  const totalImmobIncorp  = useMemo(() => hasPCG ? soldeKeys(lignesActives, ['immobIncorporelBrut','immobIncorporelAmort'], pcg, index!) : 0, [lignesActives, pcg, index])
  const totalImmobCorp    = useMemo(() => hasPCG ? soldeKeys(lignesActives, ['immobCorporelBrut','immobCorporelAmort'], pcg, index!) : 0, [lignesActives, pcg, index])
  const totalImmobFin     = useMemo(() => hasPCG ? soldeKeys(lignesActives, ['immobFinancierBrut','immobFinancierAmort'], pcg, index!) : 0, [lignesActives, pcg, index])
  const totalActifImmo    = totalImmobIncorp + totalImmobCorp + totalImmobFin
  const totalStocks       = useMemo(() => hasPCG ? soldeKeys(lignesActives, ['stocksMP','stocksEncours','stocksProduits','stocksMarchandises','stocksDepreciation'], pcg, index!) : 0, [lignesActives, pcg, index])
  const totalCreances     = useMemo(() => hasPCG ? soldeActif(lignesActives, ['creancesClients','creancesEtat','autresCreances'], pcg, index!) : 0, [lignesActives, pcg, index])
  const totalTresoA       = useMemo(() => hasPCG ? soldeActif(lignesActives, ['tresorerie'], pcg, index!) : 0, [lignesActives, pcg, index])
  const totalActifCirc    = totalStocks + totalCreances + totalTresoA
  const totalActif        = totalActifImmo + totalActifCirc

  const totalCapPropres   = useMemo(() => hasPCG ? Math.abs(soldePassif(lignesActives, ['capital','reserves','reportANouveau','resultatBilan','subventionsInvestissement','provisionsReglementees'], pcg, index!)) : 0, [lignesActives, pcg, index])
  const totalProvRisques  = useMemo(() => hasPCG ? Math.abs(soldePassif(lignesActives, ['provisions'], pcg, index!)) : 0, [lignesActives, pcg, index])
  const totalDettesLT     = useMemo(() => hasPCG ? Math.abs(soldePassif(lignesActives, ['empruntsObligation','empruntsEtablissement','autresEmprunts'], pcg, index!)) : 0, [lignesActives, pcg, index])
  const totalDettesCT     = useMemo(() => hasPCG ? Math.abs(soldePassif(lignesActives, ['dettesFournisseurs','dettesSociales','dettesFiscales','autresDettes'], pcg, index!)) : 0, [lignesActives, pcg, index])
  const totalDettes       = totalDettesLT + totalDettesCT
  const rnet120check      = lignesActives.filter(l => l.CompteNum.startsWith('120') || l.CompteNum.startsWith('129')).reduce((s,l) => s + Math.abs(l.Debit - l.Credit), 0)
  const rnetFromPL        = rnet120check < 1 ? lignesActives.filter(l => l.CompteNum.startsWith('7')).reduce((s,l) => s - (l.Debit - l.Credit), 0) - lignesActives.filter(l => l.CompteNum.startsWith('6')).reduce((s,l) => s + (l.Debit - l.Credit), 0) : 0
  const totalPassif       = totalCapPropres + totalProvRisques + totalDettes + Math.max(rnetFromPL, 0)
  const hasData           = lignesActives.length > 0 && totalActif !== 0

  const indBilan = useMemo(() => {
    if (!lignesActives.length || !hasPCG) return null
    const treso = soldeKeys(lignesActives, ['tresorerie'], pcg, index!)
    const creances = soldeKeys(lignesActives, ['creancesClients'], pcg, index!)
    const dettes = Math.abs(soldeKeys(lignesActives, ['dettesFournisseurs'], pcg, index!))
    const ca = -lignesActives.filter(l => ['701','702','703','704','705','706','707','708'].some(p => l.CompteNum.startsWith(p))).reduce((s,l) => s + (l.Debit - l.Credit), 0)
    return { treso, bfr: creances - dettes, ca }
  }, [lignesActives, pcg, index])

  if (loading || pcgLoading) return (
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
          {hasData && <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive} periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} anneeN1={anneeN1} setAnneeN1={setAnneeN1} dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1} dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!hasData ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ display:'flex', gap:16, alignItems:'flex-start', maxWidth:1400 }}>
              <div style={{ flex:1, minWidth:0 }}>
                {indBilan && <AlvioInsight payload={{ page:'balance-sheet', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ treso:indBilan.treso, bfr:indBilan.bfr, ca:indBilan.ca } }} />}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

                  {/* ACTIF */}
                  <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                    <div style={{ background:'#1A1A1A', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.07em' }}>Actif</span>
                      <span style={{ fontSize:13, fontWeight:500, color:'#B8A98A' }}>{fmt(totalActif)}</span>
                    </div>
                    <Section title="Actif immobilisé" total={totalActifImmo} color="#8C9BAB" defaultOpen={true}>
                      {totalImmobIncorp !== 0 && (<>
                        <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Incorporelles</div>
                        <BilanLigne label="Valeur brute" groupeKeys={['immobIncorporelBrut']} color="#8C9BAB" indent {...rp} />
                        <BilanLigne label="Amortissements" groupeKeys={['immobIncorporelAmort']} color="#D85A30" indent {...rp} />
                        <BilanLigne label="Immob. incorporelles nettes" groupeKeys={['immobIncorporelBrut','immobIncorporelAmort']} color="#8C9BAB" isSousTotal {...rp} />
                      </>)}
                      {totalImmobCorp !== 0 && (<>
                        <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Corporelles</div>
                        <BilanLigne label="Valeur brute" groupeKeys={['immobCorporelBrut']} color="#8C9BAB" indent {...rp} />
                        <BilanLigne label="Amortissements" groupeKeys={['immobCorporelAmort']} color="#D85A30" indent {...rp} />
                        <BilanLigne label="Immob. corporelles nettes" groupeKeys={['immobCorporelBrut','immobCorporelAmort']} color="#8C9BAB" isSousTotal {...rp} />
                      </>)}
                      {totalImmobFin !== 0 && (<>
                        <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Financières</div>
                        <BilanLigne label="Participations et prêts" groupeKeys={['immobFinancierBrut']} color="#5C6670" indent {...rp} />
                        <BilanLigne label="Provisions pour dépréciation" groupeKeys={['immobFinancierAmort']} color="#D85A30" indent {...rp} />
                        <BilanLigne label="Immob. financières nettes" groupeKeys={['immobFinancierBrut','immobFinancierAmort']} color="#5C6670" isSousTotal {...rp} />
                      </>)}
                    </Section>
                    <Section title="Actif circulant" total={totalActifCirc} color="#B8A98A" defaultOpen={true}>
                      {totalStocks !== 0 && (<>
                        <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Stocks</div>
                        <BilanLigne label="Matières premières et appros" groupeKeys={['stocksMP']} color="#B8A98A" indent {...rp} />
                        <BilanLigne label="En-cours de production" groupeKeys={['stocksEncours']} color="#B8A98A" indent {...rp} />
                        <BilanLigne label="Produits finis" groupeKeys={['stocksProduits']} color="#B8A98A" indent {...rp} />
                        <BilanLigne label="Marchandises" groupeKeys={['stocksMarchandises']} color="#B8A98A" indent {...rp} />
                        <BilanLigne label="Dépréciations stocks" groupeKeys={['stocksDepreciation']} color="#D85A30" indent {...rp} />
                        <BilanLigne label="Stocks nets" groupeKeys={['stocksMP','stocksEncours','stocksProduits','stocksMarchandises','stocksDepreciation']} color="#B8A98A" isSousTotal {...rp} />
                      </>)}
                      {totalCreances !== 0 && (<>
                        <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Créances</div>
                        <BilanLigne label="Clients et comptes rattachés" groupeKeys={['creancesClients']} color="#1A1A1A" indent {...rp} />
                        <BilanLigne label="Créances fiscales (État)" groupeKeys={['creancesEtat']} color="#1A1A1A" filterSign="actif" indent {...rp} />
                        <BilanLigne label="Autres créances" groupeKeys={['autresCreances']} color="#8C9BAB" filterSign="actif" indent {...rp} />
                        <BilanLigne label="Créances nettes" groupeKeys={['creancesClients','creancesEtat','autresCreances']} color="#1A1A1A" filterSign="actif" isSousTotal {...rp} />
                      </>)}
                      {totalTresoA !== 0 && (<>
                        <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Trésorerie</div>
                        <BilanLigne label="Disponibilités" groupeKeys={['tresorerie']} color="#1D9E75" filterSign="actif" indent {...rp} />
                      </>)}
                    </Section>
                    <BilanLigne label="Total actif" groupeKeys={['immobIncorporelBrut','immobIncorporelAmort','immobCorporelBrut','immobCorporelAmort','immobFinancierBrut','immobFinancierAmort','stocksMP','stocksEncours','stocksProduits','stocksMarchandises','stocksDepreciation','creancesClients','creancesEtat','autresCreances','tresorerie']} isTotal {...rp} />
                  </div>

                  {/* PASSIF */}
                  <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                    <div style={{ background:'#1A1A1A', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.07em' }}>Passif</span>
                      <span style={{ fontSize:13, fontWeight:500, color:'#B8A98A' }}>{fmt(Math.abs(totalPassif))}</span>
                    </div>
                    <Section title="Capitaux propres" total={Math.abs(totalCapPropres)} color="#1D9E75" defaultOpen={true}>
                      <BilanLigne label="Capital et primes d'émission" groupeKeys={['capital']} color="#1D9E75" filterSign="passif" indent {...rp} />
                      <BilanLigne label="Réserves" groupeKeys={['reserves']} color="#1D9E75" filterSign="passif" indent {...rp} />
                      <BilanLigne label="Report à nouveau" groupeKeys={['reportANouveau']} color="#1D9E75" filterSign="passif" indent {...rp} />
                      <BilanLigne label="Résultat de l'exercice" groupeKeys={['resultatBilan']} color="#1D9E75" filterSign="passif" indent {...rp} />
                      <BilanLigne label="Subventions d'investissement" groupeKeys={['subventionsInvestissement']} color="#8C9BAB" filterSign="passif" indent {...rp} />
                      <BilanLigne label="Provisions réglementées" groupeKeys={['provisionsReglementees']} color="#8C9BAB" filterSign="passif" indent {...rp} />
                      {rnetFromPL > 0 && (
                        <div style={{ display:'flex', alignItems:'center', padding:'7px 16px 7px 32px', borderBottom:'0.5px solid rgba(0,0,0,0.04)', background:'rgba(29,158,117,0.04)' }}>
                          <div style={{ flex:1, fontSize:12, color:'#1D9E75' }}>Résultat de l'exercice (calculé)</div>
                          <div style={{ fontSize:12, fontWeight:500, color:'#1D9E75' }}>{fmt(rnetFromPL)}</div>
                        </div>
                      )}
                    </Section>
                    {Math.abs(totalProvRisques) > 0.5 && (
                      <Section title="Provisions pour risques et charges" total={Math.abs(totalProvRisques)} color="#D85A30" defaultOpen={true}>
                        <BilanLigne label="Provisions pour risques et charges" groupeKeys={['provisions']} color="#D85A30" indent {...rp} />
                      </Section>
                    )}
                    <Section title="Dettes" total={Math.abs(totalDettes)} color="#D85A30" defaultOpen={true}>
                      {Math.abs(totalDettesLT) > 0.5 && (<>
                        <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Dettes financières</div>
                        <BilanLigne label="Emprunts obligataires" groupeKeys={['empruntsObligation']} color="#D85A30" filterSign="passif" indent {...rp} />
                        <BilanLigne label="Emprunts établissements de crédit" groupeKeys={['empruntsEtablissement']} color="#D85A30" filterSign="passif" indent {...rp} />
                        <BilanLigne label="Autres emprunts et dettes" groupeKeys={['autresEmprunts']} color="#D85A30" filterSign="passif" indent {...rp} />
                        <BilanLigne label="Total dettes financières" groupeKeys={['empruntsObligation','empruntsEtablissement','autresEmprunts']} color="#D85A30" filterSign="passif" isSousTotal {...rp} />
                      </>)}
                      <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Dettes d'exploitation</div>
                      <BilanLigne label="Fournisseurs et comptes rattachés" groupeKeys={['dettesFournisseurs']} color="#D85A30" filterSign="passif" indent {...rp} />
                      <BilanLigne label="Dettes sociales (personnel, URSSAF)" groupeKeys={['dettesSociales']} color="#D85A30" filterSign="passif" indent {...rp} />
                      <BilanLigne label="Dettes fiscales (IS, TVA)" groupeKeys={['dettesFiscales']} color="#D85A30" filterSign="passif" indent {...rp} />
                      <BilanLigne label="Autres dettes" groupeKeys={['autresDettes']} color="#8C9BAB" filterSign="passif" indent {...rp} />
                    </Section>
                    <BilanLigne label="Total passif" groupeKeys={['capital','reserves','reportANouveau','resultatBilan','subventionsInvestissement','provisionsReglementees','provisions','empruntsObligation','empruntsEtablissement','autresEmprunts','dettesFournisseurs','dettesSociales','dettesFiscales','autresDettes']} isTotal {...rp} />
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
