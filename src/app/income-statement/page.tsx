'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import PeriodSelector from '@/components/PeriodSelector'
import AlvioInsight from '@/components/AlvioInsight'
import { filtrerLignes } from '@/hooks/useFEC'
import type { LigneFEC } from '@/hooks/useFEC'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

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

// ── PCG complet pour le compte de résultat ──────────────────────────────────
const PCG_CR: Record<string, { prefixes: string[]; label: string; sign: 1|-1 }[]> = {
  // PRODUITS
  venteMarchandises:   [{ prefixes:['707'], label:'Ventes de marchandises', sign:-1 }],
  productionVendue:    [{ prefixes:['701'], label:'Ventes de produits finis', sign:-1 }, { prefixes:['702'], label:'Ventes de produits intermédiaires', sign:-1 }, { prefixes:['703'], label:'Ventes de produits résiduels', sign:-1 }, { prefixes:['704'], label:'Travaux', sign:-1 }, { prefixes:['705'], label:'Études et prestations', sign:-1 }, { prefixes:['706'], label:'Prestations de services', sign:-1 }, { prefixes:['708'], label:'Produits des activités annexes', sign:-1 }],
  productionStockee:   [{ prefixes:['713'], label:'Variation de stocks de produits', sign:-1 }],
  productionImmob:     [{ prefixes:['72'], label:'Production immobilisée', sign:-1 }],
  subventions:         [{ prefixes:['74'], label:'Subventions d\'exploitation', sign:-1 }],
  autresProduits:      [{ prefixes:['751'], label:'Redevances pour concessions', sign:-1 }, { prefixes:['752'], label:'Revenus des immeubles non affectés', sign:-1 }, { prefixes:['755'], label:'Quotes-parts de résultat', sign:-1 }, { prefixes:['758'], label:'Produits divers de gestion courante', sign:-1 }],
  reprises:            [{ prefixes:['781'], label:'Reprises prov. d\'exploitation', sign:-1 }, { prefixes:['791'], label:'Transferts de charges d\'exploitation', sign:-1 }],
  // CHARGES
  coutMarchandises:    [{ prefixes:['607'], label:'Achats de marchandises', sign:1 }, { prefixes:['6037'], label:'Variation de stocks — marchandises', sign:1 }],
  achatsMatières:      [{ prefixes:['601'], label:'Achats stockés — matières premières', sign:1 }, { prefixes:['6031'], label:'Variation de stocks — matières premières', sign:1 }, { prefixes:['602'], label:'Achats stockés — autres appros', sign:1 }, { prefixes:['6032'], label:'Variation de stocks — autres appros', sign:1 }],
  autresAchats:        [{ prefixes:['604'], label:'Achats d\'études et prestations', sign:1 }, { prefixes:['605'], label:'Achats de matériel', sign:1 }, { prefixes:['606'], label:'Achats non stockés', sign:1 }, { prefixes:['608'], label:'Frais accessoires sur achats', sign:1 }, { prefixes:['609'], label:'Rabais, remises, ristournes obtenus', sign:-1 }],
  servicesExt:         [{ prefixes:['611'], label:'Sous-traitance générale', sign:1 }, { prefixes:['612'], label:'Redevances de crédit-bail', sign:1 }, { prefixes:['613'], label:'Locations', sign:1 }, { prefixes:['614'], label:'Charges locatives', sign:1 }, { prefixes:['615'], label:'Entretien et réparations', sign:1 }, { prefixes:['616'], label:'Primes d\'assurances', sign:1 }, { prefixes:['617'], label:'Études et recherches', sign:1 }, { prefixes:['618'], label:'Divers (doc., colloques…)', sign:1 }, { prefixes:['619'], label:'Rabais sur services ext.', sign:-1 }],
  autresServicesExt:   [{ prefixes:['621'], label:'Personnel extérieur', sign:1 }, { prefixes:['622'], label:'Rémunérations d\'intermédiaires', sign:1 }, { prefixes:['623'], label:'Publicité, publications, relations publiques', sign:1 }, { prefixes:['624'], label:'Transports de biens', sign:1 }, { prefixes:['625'], label:'Déplacements, missions, réceptions', sign:1 }, { prefixes:['626'], label:'Frais postaux et télécommunications', sign:1 }, { prefixes:['627'], label:'Services bancaires', sign:1 }, { prefixes:['628'], label:'Divers', sign:1 }, { prefixes:['629'], label:'Rabais sur autres services ext.', sign:-1 }],
  impotsTaxes:         [{ prefixes:['631'], label:'Impôts, taxes — rémunérations', sign:1 }, { prefixes:['632'], label:'Taxes sur véhicules de sociétés', sign:1 }, { prefixes:['633'], label:'Impôts, taxes sur rémunérations', sign:1 }, { prefixes:['635'], label:'Autres impôts, taxes et versements', sign:1 }, { prefixes:['637'], label:'Autres impôts, taxes assimilés', sign:1 }],
  chargesPersonnel:    [{ prefixes:['641'], label:'Rémunérations du personnel', sign:1 }, { prefixes:['642'], label:'Rémunérations des dirigeants', sign:1 }, { prefixes:['644'], label:'Rémunérations du trav. et des associés', sign:1 }, { prefixes:['645'], label:'Charges de Sécurité Sociale', sign:1 }, { prefixes:['646'], label:'Cotisations aux caisses de retraite', sign:1 }, { prefixes:['647'], label:'Autres charges sociales', sign:1 }, { prefixes:['648'], label:'Autres charges de personnel', sign:1 }],
  dotationsExpl:       [{ prefixes:['681'], label:'Dotations amort. corporels/incorporels', sign:1 }, { prefixes:['682'], label:'Dotations amort. charges à répartir', sign:1 }, { prefixes:['685'], label:'Dotations prov. pour risques', sign:1 }, { prefixes:['687'], label:'Dotations prov. exceptionnelles', sign:1 }],
  autresCharges:       [{ prefixes:['651'], label:'Redevances pour concessions', sign:1 }, { prefixes:['653'], label:'Jetons de présence', sign:1 }, { prefixes:['654'], label:'Pertes sur créances irrécouvrables', sign:1 }, { prefixes:['655'], label:'Quotes-parts de résultat', sign:1 }, { prefixes:['658'], label:'Charges diverses de gestion courante', sign:1 }],
  // FINANCIER
  produitsFinanciers:  [{ prefixes:['761'], label:'Produits de participations', sign:-1 }, { prefixes:['762'], label:'Produits des autres immob. financières', sign:-1 }, { prefixes:['763'], label:'Revenus des créances', sign:-1 }, { prefixes:['764'], label:'Revenus des valeurs mobilières', sign:-1 }, { prefixes:['765'], label:'Escomptes obtenus', sign:-1 }, { prefixes:['766'], label:'Gains de change', sign:-1 }, { prefixes:['767'], label:'Produits nets / cessions VMP', sign:-1 }, { prefixes:['768'], label:'Autres produits financiers', sign:-1 }, { prefixes:['786'], label:'Reprises prov. financières', sign:-1 }, { prefixes:['796'], label:'Transferts de charges financières', sign:-1 }],
  chargesFinancieres:  [{ prefixes:['661'], label:'Charges d\'intérêts', sign:1 }, { prefixes:['664'], label:'Pertes sur créances liées à des participations', sign:1 }, { prefixes:['665'], label:'Escomptes accordés', sign:1 }, { prefixes:['666'], label:'Pertes de change', sign:1 }, { prefixes:['667'], label:'Charges nettes / cessions VMP', sign:1 }, { prefixes:['668'], label:'Autres charges financières', sign:1 }, { prefixes:['686'], label:'Dotations prov. financières', sign:1 }],
  // EXCEPTIONNEL
  produitsExcep:       [{ prefixes:['771'], label:'Produits except. sur op. de gestion', sign:-1 }, { prefixes:['772'], label:'Produits sur exercices antérieurs', sign:-1 }, { prefixes:['775'], label:'Produits des cessions d\'actif', sign:-1 }, { prefixes:['777'], label:'Quote-part subventions virée au résultat', sign:-1 }, { prefixes:['778'], label:'Autres produits exceptionnels', sign:-1 }, { prefixes:['787'], label:'Reprises prov. exceptionnelles', sign:-1 }, { prefixes:['797'], label:'Transferts de charges exceptionnelles', sign:-1 }],
  chargesExcep:        [{ prefixes:['671'], label:'Charges except. sur op. de gestion', sign:1 }, { prefixes:['672'], label:'Charges sur exercices antérieurs', sign:1 }, { prefixes:['675'], label:'Valeurs comptables des actifs cédés', sign:1 }, { prefixes:['678'], label:'Autres charges exceptionnelles', sign:1 }, { prefixes:['687'], label:'Dotations prov. exceptionnelles', sign:1 }],
  // IS
  participation:       [{ prefixes:['691'], label:'Participation des salariés', sign:1 }],
  is:                  [{ prefixes:['695'], label:'Impôt sur les bénéfices', sign:1 }, { prefixes:['696'], label:'Contribution additionnelle', sign:1 }, { prefixes:['699'], label:'Produits — report en arrière déficits', sign:-1 }],
}

function getSousComptes(lignes: LigneFEC[], groupeKey: string) {
  const groupe = PCG_CR[groupeKey]
  if (!groupe) return []
  const byCompte: Record<string, { label: string; valeur: number; ecritures: LigneFEC[]; sign: 1|-1 }> = {}
  for (const g of groupe) {
    for (const l of lignes) {
      if (!g.prefixes.some(p => l.CompteNum.startsWith(p))) continue
      if (!byCompte[l.CompteNum]) byCompte[l.CompteNum] = { label: l.CompteLib || g.label, valeur: 0, ecritures: [], sign: g.sign }
      byCompte[l.CompteNum].valeur += (l.Debit - l.Credit) * g.sign
      byCompte[l.CompteNum].ecritures.push(l)
    }
  }
  return Object.entries(byCompte)
    .map(([num, d]) => ({ prefix: num, label: d.label, valeur: d.valeur, ecritures: d.ecritures }))
    .filter(s => Math.abs(s.valeur) > 0.5)
    .sort((a, b) => a.prefix.localeCompare(b.prefix))
}

function soldeGroupe(lignes: LigneFEC[], groupeKey: string): number {
  return getSousComptes(lignes, groupeKey).reduce((s, c) => s + c.valeur, 0)
}

interface PanelData { compte: string; label: string; valeur: number; ecritures: LigneFEC[] }

function SidePanel({ data, onClose }: { data: PanelData; onClose: () => void }) {
  const fmtDate = (d: string) => { const iso = toIso(d); if (!iso) return d; return iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4) }
  return (
    <div style={{ width:300, flexShrink:0, background:'#fff', border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 120px)', position:'sticky', top:24 }}>
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

function CrRow({ label, groupeKeys, lignes, panelData, setPanelData, color, bold, indent, sub, isTotal }: {
  label: string; groupeKeys: string[]; lignes: LigneFEC[]
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
  color?: string; bold?: boolean; indent?: boolean; sub?: boolean; isTotal?: boolean
}) {
  const [open, setOpen] = useState(false)
  const sousComptes = useMemo(() => {
    const all: ReturnType<typeof getSousComptes> = []
    for (const k of groupeKeys) all.push(...getSousComptes(lignes, k))
    return all.sort((a, b) => a.prefix.localeCompare(b.prefix))
  }, [lignes, groupeKeys])

  const valeur = sousComptes.reduce((s, c) => s + c.valeur, 0)
  if (Math.abs(valeur) < 0.5 && !isTotal) return null

  const hasDetail = sousComptes.length > 0
  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1
  const c = color || (valeur >= 0 ? '#1A1A1A' : '#D85A30')

  if (isTotal) {
    return (
      <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A', borderTop:'0.5px solid rgba(255,255,255,0.1)' }}>
        <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>{label}</div>
        <div style={{ fontSize:14, fontWeight:500, color: valeur >= 0 ? '#1D9E75' : '#D85A30', minWidth:110, textAlign:'right' }}>{fmt(valeur)}</div>
        <div style={{ fontSize:10, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>{fmtP(valeur)}</div>
      </div>
    )
  }

  if (sub) {
    return (
      <>
        <div onClick={() => hasDetail && setOpen(o => !o)}
          style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(0,0,0,0.02)', borderTop:'0.5px solid rgba(0,0,0,0.06)', cursor: hasDetail ? 'pointer' : 'default' }}>
          <div style={{ flex:1, fontSize:12, fontWeight:500, color: c, display:'flex', alignItems:'center', gap:6 }}>
            {hasDetail && <span style={{ fontSize:9, color:'#B8A98A', transition:'transform 0.2s', display:'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>}
            {label}
          </div>
          <div style={{ fontSize:13, fontWeight:500, color: c, minWidth:110, textAlign:'right' }}>{fmt(valeur)}</div>
          <div style={{ fontSize:10, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>{}</div>
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
  }

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
        <div style={{ fontSize:10, color:'#8C9BAB', minWidth:60, textAlign:'right' }}></div>
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
  const [panelData, setPanelData] = useState<PanelData | null>(null)

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/'; return }
      const { data } = await sb.from('fec_exercices').select('annee, ecritures').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const map: Record<number,any> = {}
        for (const row of data) map[row.annee] = { annee: row.annee, lignes: row.ecritures as LigneFEC[] }
        setExercices(map)
        setAnneeActive(data[0].annee)
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

  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)

  const indBase = useMemo(() => {
    if (!lignesActives.length) return null
    const s = (ps: string[], sign: 1|-1 = 1) => { let t=0; for(const l of lignesActives) for(const p of ps) if(l.CompteNum.startsWith(p)){t+=l.Debit-l.Credit;break}; return t*sign }
    const ca = -s(['701','702','703','704','705','706','708'],-1) - s(['707'],-1)
    const rnet = ca - s(['607','6037','601','602','604','605','606','608','609','61','62']) + s(['74'],-1) - s(['63']) - s(['64']) - s(['681','686','687']) + s(['781','786','787'],-1) + s(['75'],-1) - s(['65']) + s(['76'],-1) - s(['66']) + s(['77'],-1) - s(['67']) - s(['691']) - s(['695','696','697','698','699'])
    const rex = ca - s(['607','6037','601','602','604','605','606','608','609','61','62']) + s(['74'],-1) - s(['63']) - s(['64']) - s(['681','686','687']) + s(['781','786','787'],-1) + s(['75'],-1) - s(['65'])
    const rfin = s(['76'],-1) - s(['66'])
    const mb = -s(['707'],-1) - s(['607','6037'])
    return { ca, rnet, rex, rfin, mb, tauxMb: ca>0?mb/ca*100:0, tauxRnet: ca>0?rnet/ca*100:0 }
  }, [lignesActives])

  const rowProps = { lignes: lignesActives, panelData, setPanelData }

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="income-statement"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  // Calculer totaux pour la ligne résultat net
  const totalRnet = indBase?.rnet ?? 0
  const totalCa = indBase?.ca ?? 0

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
                  {/* Header */}
                  <div style={{ display:'flex', background:'#1A1A1A', padding:'10px 16px' }}>
                    <div style={{ flex:1, fontSize:11, fontWeight:500, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.06em' }}>Libellé</div>
                    <div style={{ fontSize:11, fontWeight:500, color:'#F2F3F5', minWidth:110, textAlign:'right' }}>Montant</div>
                    <div style={{ fontSize:11, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>% CA</div>
                  </div>

                  {/* PRODUITS D'EXPLOITATION */}
                  <Section title="Produits d'exploitation" defaultOpen={true}>
                    <CrRow label="Ventes de marchandises" groupeKeys={['venteMarchandises']} {...rowProps} indent />
                    <CrRow label="Production vendue (biens et services)" groupeKeys={['productionVendue']} {...rowProps} indent />
                    <CrRow label="Production stockée" groupeKeys={['productionStockee']} {...rowProps} indent />
                    <CrRow label="Production immobilisée" groupeKeys={['productionImmob']} {...rowProps} indent />
                    <CrRow label="Subventions d'exploitation" groupeKeys={['subventions']} {...rowProps} indent />
                    <CrRow label="Autres produits de gestion courante" groupeKeys={['autresProduits']} {...rowProps} indent />
                    <CrRow label="Reprises sur prov. et transferts de charges" groupeKeys={['reprises']} {...rowProps} indent />
                    <CrRow label="Total produits d'exploitation" groupeKeys={['venteMarchandises','productionVendue','productionStockee','productionImmob','subventions','autresProduits','reprises']} {...rowProps} sub color="#B8A98A" />
                  </Section>

                  {/* CHARGES D'EXPLOITATION */}
                  <Section title="Charges d'exploitation" defaultOpen={true}>
                    <CrRow label="Achats de marchandises" groupeKeys={['coutMarchandises']} {...rowProps} indent />
                    <CrRow label="Achats de matières premières et autres appros" groupeKeys={['achatsMatières']} {...rowProps} indent />
                    <CrRow label="Autres achats et charges externes" groupeKeys={['autresAchats']} {...rowProps} indent />
                    <CrRow label="Services extérieurs" groupeKeys={['servicesExt']} {...rowProps} indent />
                    <CrRow label="Autres services extérieurs" groupeKeys={['autresServicesExt']} {...rowProps} indent />
                    <CrRow label="Impôts, taxes et versements assimilés" groupeKeys={['impotsTaxes']} {...rowProps} indent />
                    <CrRow label="Charges de personnel" groupeKeys={['chargesPersonnel']} {...rowProps} indent />
                    <CrRow label="Dotations aux amortissements et provisions" groupeKeys={['dotationsExpl']} {...rowProps} indent />
                    <CrRow label="Autres charges de gestion courante" groupeKeys={['autresCharges']} {...rowProps} indent />
                    <CrRow label="Total charges d'exploitation" groupeKeys={['coutMarchandises','achatsMatières','autresAchats','servicesExt','autresServicesExt','impotsTaxes','chargesPersonnel','dotationsExpl','autresCharges']} {...rowProps} sub color="#D85A30" />
                  </Section>

                  {/* REX */}
                  <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', background:'rgba(184,169,138,0.08)', borderTop:'0.5px solid rgba(184,169,138,0.2)' }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#1A1A1A' }}>Résultat d'exploitation</div>
                    <div style={{ fontSize:14, fontWeight:500, color: indBase.rex >= 0 ? '#1D9E75' : '#D85A30', minWidth:110, textAlign:'right' }}>{fmt(indBase.rex)}</div>
                    <div style={{ fontSize:10, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>{fmtP(indBase.ca > 0 ? indBase.rex/indBase.ca*100 : 0)}</div>
                  </div>

                  {/* FINANCIER */}
                  {(Math.abs(soldeGroupe(lignesActives,'produitsFinanciers')) > 0.5 || Math.abs(soldeGroupe(lignesActives,'chargesFinancieres')) > 0.5) && (
                    <Section title="Résultat financier">
                      <CrRow label="Produits financiers" groupeKeys={['produitsFinanciers']} {...rowProps} indent />
                      <CrRow label="Charges financières" groupeKeys={['chargesFinancieres']} {...rowProps} indent />
                      <CrRow label="Résultat financier" groupeKeys={['produitsFinanciers','chargesFinancieres']} {...rowProps} sub color={indBase.rfin >= 0 ? '#1D9E75' : '#D85A30'} />
                    </Section>
                  )}

                  {/* RCAI */}
                  {(Math.abs(soldeGroupe(lignesActives,'produitsFinanciers')) > 0.5 || Math.abs(soldeGroupe(lignesActives,'chargesFinancieres')) > 0.5) && (
                    <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', background:'rgba(184,169,138,0.04)', borderTop:'0.5px solid rgba(184,169,138,0.15)' }}>
                      <div style={{ flex:1, fontSize:12, fontWeight:500, color:'#1A1A1A' }}>Résultat courant avant impôts</div>
                      <div style={{ fontSize:13, fontWeight:500, color: (indBase.rex + indBase.rfin) >= 0 ? '#1D9E75' : '#D85A30', minWidth:110, textAlign:'right' }}>{fmt(indBase.rex + indBase.rfin)}</div>
                      <div style={{ fontSize:10, color:'#8C9BAB', minWidth:60, textAlign:'right' }}>{fmtP(indBase.ca > 0 ? (indBase.rex + indBase.rfin)/indBase.ca*100 : 0)}</div>
                    </div>
                  )}

                  {/* EXCEPTIONNEL */}
                  {(Math.abs(soldeGroupe(lignesActives,'produitsExcep')) > 0.5 || Math.abs(soldeGroupe(lignesActives,'chargesExcep')) > 0.5) && (
                    <Section title="Résultat exceptionnel">
                      <CrRow label="Produits exceptionnels" groupeKeys={['produitsExcep']} {...rowProps} indent />
                      <CrRow label="Charges exceptionnelles" groupeKeys={['chargesExcep']} {...rowProps} indent />
                      <CrRow label="Résultat exceptionnel" groupeKeys={['produitsExcep','chargesExcep']} {...rowProps} sub color={(soldeGroupe(lignesActives,'produitsExcep') - soldeGroupe(lignesActives,'chargesExcep')) >= 0 ? '#1D9E75' : '#D85A30'} />
                    </Section>
                  )}

                  {/* IS & PARTICIPATION */}
                  {(Math.abs(soldeGroupe(lignesActives,'participation')) > 0.5 || Math.abs(soldeGroupe(lignesActives,'is')) > 0.5) && (
                    <Section title="Impôt et participation">
                      <CrRow label="Participation des salariés" groupeKeys={['participation']} {...rowProps} indent />
                      <CrRow label="Impôts sur les bénéfices" groupeKeys={['is']} {...rowProps} indent />
                    </Section>
                  )}

                  {/* RÉSULTAT NET */}
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
