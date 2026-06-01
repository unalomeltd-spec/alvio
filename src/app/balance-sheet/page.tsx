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

// ── PCG complet Bilan ────────────────────────────────────────────────────────
const PCG_BILAN: Record<string, { prefixes: string[]; label: string; sign: 1|-1 }[]> = {
  // ACTIF IMMOBILISÉ
  immobIncorporelles: [{ prefixes:['201'], label:'Frais d\'établissement', sign:1 }, { prefixes:['203'], label:'Frais de recherche et développement', sign:1 }, { prefixes:['205'], label:'Concessions, brevets, licences', sign:1 }, { prefixes:['206'], label:'Droit au bail', sign:1 }, { prefixes:['207'], label:'Fonds commercial', sign:1 }, { prefixes:['208'], label:'Autres immobilisations incorporelles', sign:1 }],
  amortImmobIncorp:   [{ prefixes:['2801','2803','2805','2806','2807','2808'], label:'Amortissements immob. incorporelles', sign:-1 }],
  immobCorporelles:   [{ prefixes:['211'], label:'Terrains', sign:1 }, { prefixes:['212'], label:'Agencements de terrains', sign:1 }, { prefixes:['213'], label:'Constructions', sign:1 }, { prefixes:['214'], label:'Constructions sur sol d\'autrui', sign:1 }, { prefixes:['215'], label:'Installations techniques, matériels', sign:1 }, { prefixes:['218'], label:'Autres immobilisations corporelles', sign:1 }, { prefixes:['22'], label:'Immobilisations mises en concession', sign:1 }, { prefixes:['23'], label:'Immobilisations en cours', sign:1 }],
  amortImmobCorp:     [{ prefixes:['281'], label:'Amortissements immob. corporelles', sign:-1 }],
  immobFinancieres:   [{ prefixes:['261'], label:'Titres de participation', sign:1 }, { prefixes:['262'], label:'Titres immobilisés', sign:1 }, { prefixes:['266'], label:'Autres formes de participations', sign:1 }, { prefixes:['267'], label:'Créances rattachées à des participations', sign:1 }, { prefixes:['271'], label:'Titres immobilisés (droit de propriété)', sign:1 }, { prefixes:['272'], label:'Titres immobilisés (droit de créance)', sign:1 }, { prefixes:['274'], label:'Prêts', sign:1 }, { prefixes:['275'], label:'Dépôts et cautionnements versés', sign:1 }, { prefixes:['276'], label:'Autres créances immobilisées', sign:1 }],
  provImmobFin:       [{ prefixes:['296','297'], label:'Provisions pour dépréciation immob. fin.', sign:-1 }],
  // ACTIF CIRCULANT
  stocks:             [{ prefixes:['31'], label:'Matières premières', sign:1 }, { prefixes:['32'], label:'Autres approvisionnements', sign:1 }, { prefixes:['33'], label:'En-cours de production de biens', sign:1 }, { prefixes:['34'], label:'En-cours de production de services', sign:1 }, { prefixes:['35'], label:'Stocks de produits', sign:1 }, { prefixes:['37'], label:'Stocks de marchandises', sign:1 }],
  provStocks:         [{ prefixes:['39'], label:'Provisions pour dépréciation des stocks', sign:-1 }],
  creancesClients:    [{ prefixes:['411'], label:'Clients', sign:1 }, { prefixes:['412'], label:'Clients — effets à recevoir', sign:1 }, { prefixes:['413'], label:'Clients — effets escomptés non échus', sign:1 }, { prefixes:['416'], label:'Clients douteux ou litigieux', sign:1 }, { prefixes:['418'], label:'Clients — produits non encore facturés', sign:1 }],
  provCreances:       [{ prefixes:['491'], label:'Provisions pour dépréciation des comptes clients', sign:-1 }],
  autresCreances:     [{ prefixes:['409'], label:'Fournisseurs débiteurs', sign:1 }, { prefixes:['42'], label:'Personnel — avances et acomptes', sign:1 }, { prefixes:['43'], label:'Organismes sociaux — avances', sign:1 }, { prefixes:['44'], label:'État et collectivités — créances', sign:1 }, { prefixes:['45'], label:'Groupe et associés — créances', sign:1 }, { prefixes:['46'], label:'Débiteurs divers', sign:1 }, { prefixes:['47'], label:'Comptes transitoires actif', sign:1 }, { prefixes:['486'], label:'Charges constatées d\'avance', sign:1 }],
  valeursMobilieres:  [{ prefixes:['50'], label:'Valeurs mobilières de placement', sign:1 }, { prefixes:['59'], label:'Provisions pour dépréciation VMP', sign:-1 }],
  tresorerieActive:   [{ prefixes:['511'], label:'Valeurs à l\'encaissement', sign:1 }, { prefixes:['512'], label:'Banques', sign:1 }, { prefixes:['514'], label:'Chèques postaux', sign:1 }, { prefixes:['515'], label:'Caisses', sign:1 }, { prefixes:['518'], label:'Intérêts courus', sign:1 }, { prefixes:['53'], label:'Caisse', sign:1 }],
  compteRegularisation: [{ prefixes:['481'], label:'Charges à répartir sur plusieurs exercices', sign:1 }, { prefixes:['486'], label:'Charges constatées d\'avance', sign:1 }],
  // PASSIF — CAPITAUX PROPRES
  capital:            [{ prefixes:['101'], label:'Capital social ou individuel', sign:-1 }, { prefixes:['102'], label:'Capital souscrit — non appelé', sign:1 }, { prefixes:['104'], label:'Primes liées au capital', sign:-1 }, { prefixes:['105'], label:'Écarts de réévaluation', sign:-1 }, { prefixes:['106'], label:'Réserves', sign:-1 }, { prefixes:['107'], label:'Écart d\'équivalence', sign:-1 }],
  report:             [{ prefixes:['110'], label:'Report à nouveau (solde créditeur)', sign:-1 }, { prefixes:['119'], label:'Report à nouveau (solde débiteur)', sign:1 }],
  resultatExercice:   [{ prefixes:['120'], label:'Résultat de l\'exercice (bénéfice)', sign:-1 }, { prefixes:['129'], label:'Résultat de l\'exercice (perte)', sign:1 }],
  subventions:        [{ prefixes:['13'], label:'Subventions d\'investissement', sign:-1 }],
  provisions:         [{ prefixes:['14'], label:'Provisions réglementées', sign:-1 }, { prefixes:['15'], label:'Provisions pour risques et charges', sign:-1 }],
  // DETTES
  dettesFinancieres:  [{ prefixes:['163'], label:'Autres emprunts obligataires', sign:-1 }, { prefixes:['164'], label:'Emprunts auprès d\'établissements de crédit', sign:-1 }, { prefixes:['165'], label:'Dépôts et cautionnements reçus', sign:-1 }, { prefixes:['166'], label:'Participation des salariés', sign:-1 }, { prefixes:['167'], label:'Emprunts et dettes assorties de conditions', sign:-1 }, { prefixes:['168'], label:'Autres emprunts et dettes assimilées', sign:-1 }],
  dettesExploitation: [{ prefixes:['401'], label:'Fournisseurs', sign:-1 }, { prefixes:['403'], label:'Fournisseurs — effets à payer', sign:-1 }, { prefixes:['408'], label:'Fournisseurs — factures non parvenues', sign:-1 }, { prefixes:['421'], label:'Personnel — rémunérations dues', sign:-1 }, { prefixes:['422'], label:'Comités d\'entreprise', sign:-1 }, { prefixes:['425'], label:'Personnel — acomptes', sign:1 }, { prefixes:['428'], label:'Personnel — charges à payer', sign:-1 }, { prefixes:['431'], label:'Sécurité sociale', sign:-1 }, { prefixes:['437'], label:'Autres organismes sociaux', sign:-1 }, { prefixes:['438'], label:'Organismes sociaux — charges à payer', sign:-1 }, { prefixes:['441'], label:'État — subventions à recevoir', sign:1 }, { prefixes:['444'], label:'État — impôts sur les bénéfices', sign:-1 }, { prefixes:['445'], label:'État — taxes sur le CA', sign:-1 }, { prefixes:['447'], label:'Autres impôts, taxes et assimilés', sign:-1 }, { prefixes:['448'], label:'État — charges à payer', sign:-1 }],
  autresDettes:       [{ prefixes:['455'], label:'Associés — comptes courants', sign:-1 }, { prefixes:['457'], label:'Associés — dividendes à payer', sign:-1 }, { prefixes:['462'], label:'Créditeurs divers', sign:-1 }, { prefixes:['487'], label:'Produits constatés d\'avance', sign:-1 }],
  tresoreriePassive:  [{ prefixes:['501'], label:'Obligations et bons à court terme', sign:-1 }, { prefixes:['504'], label:'Autres valeurs mobilières', sign:-1 }, { prefixes:['519'], label:'Concours bancaires courants', sign:-1 }],
}

function getSousComptes(lignes: LigneFEC[], groupeKey: string) {
  const groupe = PCG_BILAN[groupeKey]
  if (!groupe) return []
  const byCompte: Record<string, { label: string; valeur: number; ecritures: LigneFEC[] }> = {}
  for (const g of groupe) {
    for (const l of lignes) {
      if (!g.prefixes.some(p => l.CompteNum.startsWith(p))) continue
      if (!byCompte[l.CompteNum]) byCompte[l.CompteNum] = { label: l.CompteLib || g.label, valeur: 0, ecritures: [] }
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

function BilanRow({ label, groupeKeys, lignes, panelData, setPanelData, color, bold, indent, isTotalSection }: {
  label: string; groupeKeys: string[]; lignes: LigneFEC[]
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
  color?: string; bold?: boolean; indent?: boolean; isTotalSection?: boolean
}) {
  const [open, setOpen] = useState(false)
  const sousComptes = useMemo(() => {
    const all: ReturnType<typeof getSousComptes> = []
    for (const k of groupeKeys) all.push(...getSousComptes(lignes, k))
    return all.sort((a, b) => a.prefix.localeCompare(b.prefix))
  }, [lignes, groupeKeys])

  const valeur = sousComptes.reduce((s, c) => s + c.valeur, 0)
  if (Math.abs(valeur) < 0.5 && !isTotalSection) return null

  const hasDetail = sousComptes.length > 0
  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1
  const c = color || (valeur >= 0 ? '#1A1A1A' : '#D85A30')

  if (isTotalSection) {
    return (
      <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', background:'rgba(184,169,138,0.08)', borderTop:'1px solid rgba(184,169,138,0.2)' }}>
        <div style={{ flex:1, fontSize:12, fontWeight:500, color:'#1A1A1A' }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:500, color: c, minWidth:110, textAlign:'right' }}>{fmt(valeur)}</div>
      </div>
    )
  }

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
        <div style={{ fontSize:12, fontWeight: bold ? 500 : 400, color: c, minWidth:110, textAlign:'right' }}>{fmt(valeur)}</div>
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
                  <div style={{ height:'100%', width:`${pctBar}%`, background: color || '#B8A98A', borderRadius:2 }} />
                </div>
                <span style={{ fontSize:12, fontWeight:500, color: color || '#1A1A1A', minWidth:90, textAlign:'right' }}>{fmt(Math.abs(sc.valeur))}</span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Section({ title, children, defaultOpen = false, total }: { title: string; children: React.ReactNode; defaultOpen?: boolean; total?: number }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(184,169,138,0.06)', cursor:'pointer', borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
        <div style={{ flex:1, fontSize:12, fontWeight:500, color:'#1A1A1A', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:9, color:'#B8A98A', display:'inline-block', transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          {title}
        </div>
        {total !== undefined && <span style={{ fontSize:12, fontWeight:500, color:'#B8A98A' }}>{fmt(total)}</span>}
      </div>
      {open && children}
    </div>
  )
}

export default function BalanceSheetPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const [anneeActive, setAnneeActive] = useState(new Date().getFullYear())
  const [periodeTab, setPeriodeTab] = useState<'exercice'|'perso'>('exercice')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [anneeN1, setAnneeN1] = useState(new Date().getFullYear() - 1)
  const [dateDebutN1, setDateDebutN1] = useState('')
  const [dateFinN1, setDateFinN1] = useState('')
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

  const indBilan = useMemo(() => {
    if (!lignesActives.length) return null
    const treso = soldeGroupe(lignesActives, 'tresorerieActive')
    const creances = soldeGroupe(lignesActives, 'creancesClients')
    const dettesF = Math.abs(soldeGroupe(lignesActives, 'dettesExploitation'))
    const bfr = creances - dettesF
    const s = (ps: string[]) => { let t=0; for(const l of lignesActives) for(const p of ps) if(l.CompteNum.startsWith(p)){t+=l.Debit-l.Credit;break}; return t }
    const ca = -s(['701','702','703','704','705','706','707','708'])
    return { treso, bfr, ca }
  }, [lignesActives])

  const totalActifImmo = useMemo(() => ['immobIncorporelles','amortImmobIncorp','immobCorporelles','amortImmobCorp','immobFinancieres','provImmobFin'].reduce((s,k) => s + soldeGroupe(lignesActives, k), 0), [lignesActives])
  const totalActifCirc = useMemo(() => ['stocks','provStocks','creancesClients','provCreances','autresCreances','valeursMobilieres','tresorerieActive'].reduce((s,k) => s + soldeGroupe(lignesActives, k), 0), [lignesActives])
  const totalActif = totalActifImmo + totalActifCirc
  const totalCapPropres = useMemo(() => ['capital','report','resultatExercice','subventions'].reduce((s,k) => s + soldeGroupe(lignesActives, k), 0), [lignesActives])
  const totalProvisions = useMemo(() => soldeGroupe(lignesActives, 'provisions'), [lignesActives])
  const totalDettes = useMemo(() => ['dettesFinancieres','dettesExploitation','autresDettes','tresoreriePassive'].reduce((s,k) => s + soldeGroupe(lignesActives, k), 0), [lignesActives])
  const totalPassif = totalCapPropres + totalProvisions + totalDettes

  const hasData = lignesActives.length > 0 && totalActif !== 0
  const rowProps = { lignes: lignesActives, panelData, setPanelData }

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
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
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
            <div style={{ display:'flex', gap:16, alignItems:'flex-start', maxWidth:1200 }}>
              <div style={{ flex:1, minWidth:0 }}>
                {indBilan && <AlvioInsight payload={{ page:'balance-sheet', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ treso:indBilan.treso, bfr:indBilan.bfr, ca:indBilan.ca } }} />}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

                  {/* ACTIF */}
                  <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                    <div style={{ background:'#1A1A1A', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:500, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.06em' }}>Actif</span>
                      <span style={{ fontSize:12, fontWeight:500, color:'#B8A98A' }}>{fmt(totalActif)}</span>
                    </div>

                    <Section title="Actif immobilisé" total={totalActifImmo} defaultOpen={true}>
                      <BilanRow label="Immobilisations incorporelles (nettes)" groupeKeys={['immobIncorporelles','amortImmobIncorp']} color="#B8A98A" indent {...rowProps} />
                      <BilanRow label="Immobilisations corporelles (nettes)" groupeKeys={['immobCorporelles','amortImmobCorp']} color="#8C9BAB" indent {...rowProps} />
                      <BilanRow label="Immobilisations financières (nettes)" groupeKeys={['immobFinancieres','provImmobFin']} color="#5C6670" indent {...rowProps} />
                      <BilanRow label="Total actif immobilisé" groupeKeys={['immobIncorporelles','amortImmobIncorp','immobCorporelles','amortImmobCorp','immobFinancieres','provImmobFin']} isTotalSection color="#1A1A1A" {...rowProps} />
                    </Section>

                    <Section title="Actif circulant" total={totalActifCirc} defaultOpen={true}>
                      <BilanRow label="Stocks et en-cours" groupeKeys={['stocks','provStocks']} color="#B8A98A" indent {...rowProps} />
                      <BilanRow label="Créances clients (nettes)" groupeKeys={['creancesClients','provCreances']} color="#1A1A1A" indent {...rowProps} />
                      <BilanRow label="Autres créances et comptes de régularisation" groupeKeys={['autresCreances']} color="#8C9BAB" indent {...rowProps} />
                      <BilanRow label="Valeurs mobilières de placement" groupeKeys={['valeursMobilieres']} color="#5C6670" indent {...rowProps} />
                      <BilanRow label="Disponibilités" groupeKeys={['tresorerieActive']} color="#1D9E75" indent {...rowProps} />
                      <BilanRow label="Total actif circulant" groupeKeys={['stocks','provStocks','creancesClients','provCreances','autresCreances','valeursMobilieres','tresorerieActive']} isTotalSection color="#1A1A1A" {...rowProps} />
                    </Section>

                    <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A' }}>
                      <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>Total actif</div>
                      <div style={{ fontSize:14, fontWeight:500, color:'#B8A98A' }}>{fmt(totalActif)}</div>
                    </div>
                  </div>

                  {/* PASSIF */}
                  <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                    <div style={{ background:'#1A1A1A', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:500, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.06em' }}>Passif</span>
                      <span style={{ fontSize:12, fontWeight:500, color:'#B8A98A' }}>{fmt(totalPassif)}</span>
                    </div>

                    <Section title="Capitaux propres" total={totalCapPropres} defaultOpen={true}>
                      <BilanRow label="Capital et primes" groupeKeys={['capital']} color="#1D9E75" indent {...rowProps} />
                      <BilanRow label="Réserves et report à nouveau" groupeKeys={['report']} color="#1D9E75" indent {...rowProps} />
                      <BilanRow label="Résultat de l'exercice" groupeKeys={['resultatExercice']} color="#1D9E75" indent {...rowProps} />
                      <BilanRow label="Subventions d'investissement" groupeKeys={['subventions']} color="#8C9BAB" indent {...rowProps} />
                      <BilanRow label="Total capitaux propres" groupeKeys={['capital','report','resultatExercice','subventions']} isTotalSection color="#1D9E75" {...rowProps} />
                    </Section>

                    {Math.abs(totalProvisions) > 0.5 && (
                      <Section title="Provisions pour risques et charges" total={totalProvisions}>
                        <BilanRow label="Provisions réglementées et pour risques" groupeKeys={['provisions']} color="#D85A30" indent {...rowProps} />
                      </Section>
                    )}

                    <Section title="Dettes" total={totalDettes} defaultOpen={true}>
                      <BilanRow label="Emprunts et dettes financières" groupeKeys={['dettesFinancieres']} color="#D85A30" indent {...rowProps} />
                      <BilanRow label="Dettes d'exploitation (fournisseurs, social, fiscal)" groupeKeys={['dettesExploitation']} color="#D85A30" indent {...rowProps} />
                      <BilanRow label="Autres dettes et produits constatés d'avance" groupeKeys={['autresDettes']} color="#8C9BAB" indent {...rowProps} />
                      <BilanRow label="Trésorerie passive (concours bancaires)" groupeKeys={['tresoreriePassive']} color="#993C1D" indent {...rowProps} />
                      <BilanRow label="Total dettes" groupeKeys={['dettesFinancieres','dettesExploitation','autresDettes','tresoreriePassive']} isTotalSection color="#D85A30" {...rowProps} />
                    </Section>

                    <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A' }}>
                      <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>Total passif</div>
                      <div style={{ fontSize:14, fontWeight:500, color:'#B8A98A' }}>{fmt(totalPassif)}</div>
                    </div>
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
