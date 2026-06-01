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

function solde(lignes: LigneFEC[], prefixes: string[], sign: 1 | -1 = 1): number {
  let t = 0
  for (const l of lignes)
    for (const p of prefixes)
      if (l.CompteNum.startsWith(p)) { t += l.Debit - l.Credit; break }
  return t * sign
}

function calculerSIG(lignes: LigneFEC[]) {
  const venteMarchandises  = -solde(lignes, ['707'], -1)
  const coutMarchandises   =  solde(lignes, ['607', '6037'])
  const margeCommerciale   = venteMarchandises - coutMarchandises

  const prodVendue         = -solde(lignes, ['701','702','703','704','705','706','708'], -1)
  const prodStockee        = -solde(lignes, ['713'], -1)
  const prodImmobilisee    = -solde(lignes, ['72'], -1)
  const productionExercice = prodVendue + prodStockee + prodImmobilisee

  const consommationsExt   = solde(lignes, ['601','602','604','605','606','608','609','61','62'])
  const subventions        = -solde(lignes, ['74'], -1)
  const valeurAjoutee      = margeCommerciale + productionExercice - consommationsExt + subventions

  const impotsTaxes        = solde(lignes, ['63'])
  const chargesPersonnel   = solde(lignes, ['64'])
  const ebe                = valeurAjoutee - impotsTaxes - chargesPersonnel

  const dotations          = solde(lignes, ['681','686','687'])
  const reprises           = -solde(lignes, ['781','786','787'], -1)
  const autresProduits     = -solde(lignes, ['75'], -1)
  const autresCharges      = solde(lignes, ['65'])
  const rex                = ebe - dotations + reprises + autresProduits - autresCharges

  const produitsFinanciers = -solde(lignes, ['76'], -1)
  const chargesFinancieres = solde(lignes, ['66'])
  const resultatFinancier  = produitsFinanciers - chargesFinancieres
  const rcai               = rex + resultatFinancier

  const produitsExcep      = -solde(lignes, ['77'], -1)
  const chargesExcep       = solde(lignes, ['67'])
  const resultatExcep      = produitsExcep - chargesExcep

  const participation      = solde(lignes, ['691'])
  const is                 = solde(lignes, ['695','696','697','698','699'])
  const resultatNet        = rcai + resultatExcep - participation - is

  const ca                 = prodVendue + venteMarchandises
  const tauxMb             = ca > 0 ? margeCommerciale / ca * 100 : 0
  const tauxEbe            = ca > 0 ? ebe / ca * 100 : 0
  const tauxRex            = ca > 0 ? rex / ca * 100 : 0
  const tauxRnet           = ca > 0 ? resultatNet / ca * 100 : 0
  const tauxPers           = ca > 0 ? chargesPersonnel / ca * 100 : 0

  return {
    venteMarchandises, coutMarchandises, margeCommerciale,
    prodVendue, prodStockee, prodImmobilisee, productionExercice,
    consommationsExt, subventions, valeurAjoutee,
    impotsTaxes, chargesPersonnel, ebe,
    dotations, reprises, autresProduits, autresCharges, rex,
    produitsFinanciers, chargesFinancieres, resultatFinancier, rcai,
    produitsExcep, chargesExcep, resultatExcep,
    participation, is, resultatNet,
    ca, tauxMb, tauxEbe, tauxRex, tauxRnet, tauxPers,
    achats: coutMarchandises + consommationsExt,
    mb: margeCommerciale, ext: consommationsExt, imp63: impotsTaxes,
    pers64: chargesPersonnel, dot68: dotations, fin66: chargesFinancieres,
    fin76: produitsFinanciers, exc67: chargesExcep, exc77: produitsExcep,
    is695: is, rfin: resultatFinancier, rnet: resultatNet,
  }
}

function DeltaBadge({ val, pct }: { val: number; pct: number }) {
  const up = val >= 0
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: up ? '#1D9E75' : '#D85A30', whiteSpace: 'nowrap' }}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{fmt(val)} ({fmtP(Math.abs(pct))})
    </span>
  )
}

function SigRow({
  icon, label, value, pct, color, highlight, explain, deductions, delta
}: {
  icon: string; label: string; value: number; pct?: number; color?: string
  highlight?: boolean; explain: string; explainDetail: string
  deductions?: { label: string; value: number; badge?: string }[]
  delta?: { val: number; pct: number } | null
}) {
  const [hov, setHov] = useState(false)
  const c = color || (highlight ? '#B8A98A' : '#8C9BAB')
  const bg = highlight ? '#1A1A1A' : hov ? 'rgba(0,0,0,0.02)' : '#fff'
  const textColor = highlight ? '#fff' : '#1A1A1A'
  const mutedColor = highlight ? 'rgba(255,255,255,0.5)' : '#8C9BAB'

  return (
    <>
      {deductions?.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px 5px 28px', marginBottom: 2 }}>
          <div style={{ flex: 1, height: 0.5, background: 'rgba(0,0,0,0.08)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: d.value < 0 ? '#1D9E75' : '#993C1D', background: d.value < 0 ? 'rgba(29,158,117,0.08)' : 'rgba(216,90,48,0.08)', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
            {d.value < 0 ? '+' : '−'} {d.label}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: d.value < 0 ? '#1D9E75' : '#D85A30', minWidth: 80, textAlign: 'right' }}>{fmt(Math.abs(d.value))}</span>
          <div style={{ flex: 1, height: 0.5, background: 'rgba(0,0,0,0.08)' }} />
        </div>
      ))}

      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 4, transition: 'all 0.15s' }}>
        <div style={{
          flex: 1, background: bg, border: `0.5px solid ${highlight ? '#1A1A1A' : 'rgba(0,0,0,0.06)'}`,
          borderLeft: `3px solid ${c}`, borderRadius: '0 10px 10px 0',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          transition: 'all 0.2s', cursor: 'default',
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: highlight ? 'rgba(184,169,138,0.15)' : `${c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: highlight ? '#fff' : (color || textColor), lineHeight: 1 }}>{fmt(value)}</div>
            {pct !== undefined && <div style={{ fontSize: 11, color: mutedColor, marginTop: 3 }}>{fmtP(pct)} du CA</div>}
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            {delta && <DeltaBadge val={delta.val} pct={delta.pct} />}
          </div>
        </div>
        <div style={{ width: 190, flexShrink: 0, background: 'rgba(0,0,0,0.02)', border: '0.5px solid rgba(0,0,0,0.05)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#1A1A1A', marginBottom: 3 }}>{explain}</div>
        </div>
      </div>
    </>
  )
}

export default function ProfitabilityPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const [anneeActive, setAnneeActive] = useState(new Date().getFullYear())
  const [periodeTab, setPeriodeTab] = useState<'exercice'|'perso'>('exercice')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [anneeN1, setAnneeN1] = useState(new Date().getFullYear() - 1)
  const [dateDebutN1, setDateDebutN1] = useState('')
  const [dateFinN1, setDateFinN1] = useState('')
  const [loading, setLoading] = useState(true)

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

  const lignesN1: LigneFEC[] = useMemo(() => {
    if (dateDebutN1 && dateFinN1) {
      const merged: LigneFEC[] = []
      for (const a of Object.keys(exercices).map(Number).sort((x,y) => x-y)) {
        const ex = exercices[a]; if (!ex) continue
        const dates = ex.lignes.map((l:LigneFEC) => toIso(l.EcritureDate)).filter(Boolean).sort()
        if (dates.length && toIso(dates[dates.length-1]) >= dateDebutN1 && toIso(dates[0]) <= dateFinN1)
          merged.push(...filtrerLignes(ex.lignes, 'perso', dateDebutN1, dateFinN1))
      }
      if (merged.length > 0) return merged
    }
    return exercices[anneeN1]?.lignes ?? []
  }, [exercices, anneeN1, dateDebutN1, dateFinN1])

  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)
  const sig = useMemo(() => lignesActives.length > 0 ? calculerSIG(lignesActives) : null, [lignesActives])
  const sigN1 = useMemo(() => lignesN1.length > 0 ? calculerSIG(lignesN1) : null, [lignesN1])

  const show = (v: number) => Math.abs(v) > 0.5

  const delta = (v: number, vN1: number | undefined) => {
    if (!vN1 || !sigN1) return null
    return { val: v - vN1, pct: (v - vN1) / Math.abs(vN1) * 100 }
  }

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Rentabilité</span>
          {sig && <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive} periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} anneeN1={anneeN1} setAnneeN1={setAnneeN1} dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1} dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />}
        </div>

        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!sig ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:900 }}>

              <AlvioInsight payload={{ page:'profitability', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ ca:sig.ca, mb:sig.mb, ebe:sig.ebe, rex:sig.rex, rnet:sig.rnet, tauxMb:sig.tauxMb, tauxEbe:sig.tauxEbe, tauxRex:sig.tauxRex, tauxRnet:sig.tauxRnet, tauxPers:sig.tauxPers, pers64:sig.pers64 } }} />

              <div style={{ fontSize:11, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>
                Soldes intermédiaires de gestion
              </div>

              {/* CA */}
              <SigRow icon="💰" label="Chiffre d'affaires" value={sig.ca}
                pct={100} color="#B8A98A"
                explain="Total de vos ventes, hors taxes"
                explainDetail="Point de départ de toute l'analyse."
                delta={delta(sig.ca, sigN1?.ca)} />

              {/* Marge commerciale — seulement si activité négoce */}
              {show(sig.margeCommerciale) && (
                <SigRow icon="🏪" label="Marge commerciale" value={sig.margeCommerciale}
                  pct={sig.ca > 0 ? sig.margeCommerciale/sig.ca*100 : 0} color="#B8A98A"
                  explain="Ce que vous gagnez sur la revente de marchandises"
                  explainDetail="Ventes de marchandises moins coût d'achat."
                  deductions={[{ label: 'Coût d\'achat des marchandises', value: sig.coutMarchandises }]}
                  delta={delta(sig.margeCommerciale, sigN1?.margeCommerciale)} />
              )}

              {/* Production — seulement si stockage ou immobilisation */}
              {(show(sig.prodStockee) || show(sig.prodImmobilisee)) && (
                <SigRow icon="🏭" label="Production de l'exercice" value={sig.productionExercice}
                  pct={sig.ca > 0 ? sig.productionExercice/sig.ca*100 : 0}
                  explain="Ventes + production stockée + production immobilisée"
                  explainDetail="Pertinent pour les activités industrielles."
                  deductions={[
                    ...(show(sig.prodStockee) ? [{ label: 'Production stockée', value: -sig.prodStockee }] : []),
                    ...(show(sig.prodImmobilisee) ? [{ label: 'Production immobilisée', value: -sig.prodImmobilisee }] : []),
                  ]}
                  delta={null} />
              )}

              {/* Valeur ajoutée */}
              <SigRow icon="⚙️" label="Valeur ajoutée" value={sig.valeurAjoutee}
                pct={sig.ca > 0 ? sig.valeurAjoutee/sig.ca*100 : 0}
                explain="La richesse créée par votre entreprise"
                explainDetail="Sert à payer salariés, État et actionnaires."
                deductions={[
                  { label: 'Consommations externes', value: sig.consommationsExt },
                  ...(show(sig.subventions) ? [{ label: 'Subventions d\'exploitation', value: -sig.subventions }] : []),
                ]}
                delta={delta(sig.valeurAjoutee, sigN1?.valeurAjoutee)} />

              {/* EBE */}
              <SigRow icon="⚡" label="EBE — Excédent Brut d'Exploitation" value={sig.ebe}
                pct={sig.tauxEbe} color={sig.tauxEbe >= 10 ? '#1D9E75' : '#D85A30'}
                highlight={true}
                explain="Le vrai baromètre de votre rentabilité opérationnelle"
                explainDetail="Avant amortissements et charges financières."
                deductions={[
                  ...(show(sig.impotsTaxes) ? [{ label: 'Impôts & taxes (hors IS)', value: sig.impotsTaxes }] : []),
                  { label: 'Charges de personnel', value: sig.chargesPersonnel },
                ]}
                delta={delta(sig.ebe, sigN1?.ebe)} />

              {/* REX */}
              <SigRow icon="🎯" label="Résultat d'exploitation" value={sig.rex}
                pct={sig.tauxRex} color={sig.rex >= 0 ? '#1D9E75' : '#D85A30'}
                explain="Rentabilité du cœur de métier, après amortissements"
                explainDetail="Hors éléments financiers et exceptionnels."
                deductions={[
                  ...(show(sig.dotations) ? [{ label: 'Dotations aux amortissements', value: sig.dotations }] : []),
                  ...(show(sig.reprises) ? [{ label: 'Reprises sur amortissements', value: -sig.reprises }] : []),
                  ...(show(sig.autresProduits) ? [{ label: 'Autres produits (75)', value: -sig.autresProduits }] : []),
                  ...(show(sig.autresCharges) ? [{ label: 'Autres charges (65)', value: sig.autresCharges }] : []),
                ]}
                delta={delta(sig.rex, sigN1?.rex)} />

              {/* RCAI — seulement si résultat financier non nul */}
              {show(sig.resultatFinancier) && (
                <SigRow icon="🏦" label="Résultat courant avant impôts" value={sig.rcai}
                  pct={sig.ca > 0 ? sig.rcai/sig.ca*100 : 0}
                  color={sig.rcai >= 0 ? '#1D9E75' : '#D85A30'}
                  explain="REX + résultat financier (intérêts d'emprunts, placements)"
                  explainDetail="Montre l'impact de votre dette ou de vos placements."
                  deductions={[
                    ...(show(sig.produitsFinanciers) ? [{ label: 'Produits financiers', value: -sig.produitsFinanciers }] : []),
                    ...(show(sig.chargesFinancieres) ? [{ label: 'Charges financières', value: sig.chargesFinancieres }] : []),
                  ]}
                  delta={delta(sig.rcai, sigN1?.rcai)} />
              )}

              {/* Résultat exceptionnel — seulement si non nul */}
              {show(sig.resultatExcep) && (
                <SigRow icon="⚠️" label="Résultat exceptionnel" value={sig.resultatExcep}
                  pct={sig.ca > 0 ? sig.resultatExcep/sig.ca*100 : 0}
                  color={sig.resultatExcep >= 0 ? '#1D9E75' : '#D85A30'}
                  explain="Éléments ponctuels hors activité normale"
                  explainDetail="Cessions d'actifs, pénalités, événements rares."
                  deductions={[
                    ...(show(sig.produitsExcep) ? [{ label: 'Produits exceptionnels', value: -sig.produitsExcep }] : []),
                    ...(show(sig.chargesExcep) ? [{ label: 'Charges exceptionnelles', value: sig.chargesExcep }] : []),
                  ]}
                  delta={delta(sig.resultatExcep, sigN1?.resultatExcep)} />
              )}

              {/* Résultat net */}
              <SigRow icon="✅" label="Résultat net" value={sig.rnet}
                pct={sig.tauxRnet} color={sig.rnet >= 0 ? '#1D9E75' : '#D85A30'}
                explain="Ce que vous gardez après tout — impôts inclus"
                explainDetail="Le bénéfice final distribuable ou mis en réserve."
                deductions={[
                  ...(show(sig.participation) ? [{ label: 'Participation des salariés', value: sig.participation }] : []),
                  ...(show(sig.is) ? [{ label: 'Impôt sur les sociétés', value: sig.is }] : []),
                ]}
                delta={delta(sig.rnet, sigN1?.rnet)} />

            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
