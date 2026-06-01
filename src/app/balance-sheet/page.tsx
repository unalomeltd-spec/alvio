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

const PCG_BILAN: Record<string, { prefixes: string[]; label: string; sign: 1|-1 }[]> = {
  // ACTIF IMMOBILISÉ
  immobIncorpBrut:    [{ prefixes:['201'], label:'Frais d\'établissement', sign:1 }, { prefixes:['203'], label:'Frais de R&D', sign:1 }, { prefixes:['205'], label:'Concessions, brevets, licences', sign:1 }, { prefixes:['206'], label:'Droit au bail', sign:1 }, { prefixes:['207'], label:'Fonds commercial', sign:1 }, { prefixes:['208'], label:'Autres immob. incorporelles', sign:1 }],
  immobIncorpAmort:   [{ prefixes:['2801','2803','2805','2806','2807','2808'], label:'Amortissements immob. incorporelles', sign:-1 }],
  immobCorpBrut:      [{ prefixes:['211'], label:'Terrains', sign:1 }, { prefixes:['212'], label:'Agencements de terrains', sign:1 }, { prefixes:['213'], label:'Constructions', sign:1 }, { prefixes:['215'], label:'Installations techniques, matériels', sign:1 }, { prefixes:['218'], label:'Autres immob. corporelles', sign:1 }, { prefixes:['22'], label:'Immob. en concession', sign:1 }, { prefixes:['23'], label:'Immob. en cours', sign:1 }],
  immobCorpAmort:     [{ prefixes:['281'], label:'Amortissements immob. corporelles', sign:-1 }],
  immobFinBrut:       [{ prefixes:['261'], label:'Titres de participation', sign:1 }, { prefixes:['267'], label:'Créances sur participations', sign:1 }, { prefixes:['271'], label:'Titres immobilisés', sign:1 }, { prefixes:['274'], label:'Prêts', sign:1 }, { prefixes:['275'], label:'Dépôts et cautionnements', sign:1 }, { prefixes:['276'], label:'Autres créances immobilisées', sign:1 }],
  immobFinProv:       [{ prefixes:['296','297'], label:'Provisions pour dépréciation immob. fin.', sign:-1 }],
  // ACTIF CIRCULANT
  stocksMP:           [{ prefixes:['31'], label:'Matières premières', sign:1 }, { prefixes:['32'], label:'Autres approvisionnements', sign:1 }],
  stocksEncours:      [{ prefixes:['33'], label:'En-cours de production de biens', sign:1 }, { prefixes:['34'], label:'En-cours de production de services', sign:1 }],
  stocksProduits:     [{ prefixes:['35'], label:'Stocks de produits finis', sign:1 }],
  stocksMarchandises: [{ prefixes:['37'], label:'Stocks de marchandises', sign:1 }],
  provStocks:         [{ prefixes:['39'], label:'Provisions pour dépréciation stocks', sign:-1 }],
  creancesClients:    [{ prefixes:['411'], label:'Clients', sign:1 }, { prefixes:['413'], label:'Effets à recevoir', sign:1 }, { prefixes:['416'], label:'Clients douteux', sign:1 }, { prefixes:['418'], label:'Factures à établir', sign:1 }],
  provCreances:       [{ prefixes:['491'], label:'Provisions créances douteuses', sign:-1 }],
  creancesEtat:       [{ prefixes:['44'], label:'État — créances fiscales', sign:1 }],
  autresCreances:     [{ prefixes:['409'], label:'Fournisseurs débiteurs', sign:1 }, { prefixes:['42'], label:'Personnel — avances', sign:1 }, { prefixes:['43'], label:'Organismes sociaux — avances', sign:1 }, { prefixes:['45'], label:'Groupe et associés', sign:1 }, { prefixes:['46'], label:'Débiteurs divers', sign:1 }, { prefixes:['486'], label:'Charges constatées d\'avance', sign:1 }],
  vmp:                [{ prefixes:['50'], label:'Valeurs mobilières de placement', sign:1 }, { prefixes:['59'], label:'Provisions pour dépréciation VMP', sign:-1 }],
  banques:            [{ prefixes:['512'], label:'Banques', sign:1 }, { prefixes:['514'], label:'Chèques postaux', sign:1 }],
  caisse:             [{ prefixes:['53'], label:'Caisse', sign:1 }, { prefixes:['515'], label:'Autres disponibilités', sign:1 }],
  autresTresoA:       [{ prefixes:['511'], label:'Valeurs à l\'encaissement', sign:1 }],
  chargesRepartir:    [{ prefixes:['481'], label:'Charges à répartir', sign:1 }],
  // PASSIF — CAPITAUX PROPRES
  capital:            [{ prefixes:['101'], label:'Capital social', sign:-1 }, { prefixes:['104'], label:'Primes d\'émission', sign:-1 }, { prefixes:['105'], label:'Écarts de réévaluation', sign:-1 }],
  reserves:           [{ prefixes:['106'], label:'Réserves', sign:-1 }, { prefixes:['107'], label:'Écart d\'équivalence', sign:-1 }],
  reportANouveau:     [{ prefixes:['110'], label:'Report à nouveau créditeur', sign:-1 }, { prefixes:['119'], label:'Report à nouveau débiteur', sign:1 }],
  resultatN:          [{ prefixes:['120'], label:'Bénéfice de l\'exercice', sign:-1 }, { prefixes:['129'], label:'Perte de l\'exercice', sign:1 }],
  subventionsInvest:  [{ prefixes:['13'], label:'Subventions d\'investissement', sign:-1 }],
  provReglementees:   [{ prefixes:['14'], label:'Provisions réglementées', sign:-1 }],
  // PROVISIONS
  provRisques:        [{ prefixes:['151'], label:'Provisions pour litiges', sign:-1 }, { prefixes:['153'], label:'Provisions pour garanties clients', sign:-1 }, { prefixes:['155'], label:'Provisions pour pertes de change', sign:-1 }, { prefixes:['157'], label:'Provisions pour charges de retraite', sign:-1 }, { prefixes:['158'], label:'Autres provisions pour risques', sign:-1 }],
  provCharges:        [{ prefixes:['159'], label:'Provisions pour charges', sign:-1 }],
  // DETTES
  empruntsOblig:      [{ prefixes:['163'], label:'Emprunts obligataires', sign:-1 }],
  empruntsEtab:       [{ prefixes:['164'], label:'Emprunts établissements de crédit', sign:-1 }],
  autresEmprunts:     [{ prefixes:['165'], label:'Dépôts et cautionnements reçus', sign:-1 }, { prefixes:['166'], label:'Participation des salariés', sign:-1 }, { prefixes:['167'], label:'Emprunts avec conditions', sign:-1 }, { prefixes:['168'], label:'Autres emprunts', sign:-1 }],
  dettesFourn:        [{ prefixes:['401'], label:'Fournisseurs', sign:-1 }, { prefixes:['403'], label:'Effets à payer', sign:-1 }, { prefixes:['408'], label:'Factures non parvenues', sign:-1 }],
  dettesSociales:     [{ prefixes:['421'], label:'Rémunérations dues', sign:-1 }, { prefixes:['422'], label:'Comités d\'entreprise', sign:-1 }, { prefixes:['428'], label:'Charges sociales à payer', sign:-1 }, { prefixes:['431'], label:'Sécurité sociale', sign:-1 }, { prefixes:['437'], label:'Autres organismes sociaux', sign:-1 }, { prefixes:['438'], label:'Charges sociales à payer', sign:-1 }],
  dettesFiscales:     [{ prefixes:['444'], label:'IS à payer', sign:-1 }, { prefixes:['445'], label:'TVA à payer', sign:-1 }, { prefixes:['447'], label:'Autres impôts et taxes', sign:-1 }, { prefixes:['448'], label:'Charges fiscales à payer', sign:-1 }],
  autresDettes:       [{ prefixes:['455'], label:'Associés — comptes courants', sign:-1 }, { prefixes:['457'], label:'Dividendes à payer', sign:-1 }, { prefixes:['462'], label:'Créditeurs divers', sign:-1 }, { prefixes:['487'], label:'Produits constatés d\'avance', sign:-1 }],
  concoursBancaires:  [{ prefixes:['519'], label:'Concours bancaires courants', sign:-1 }],
}

function getSousComptes(lignes: LigneFEC[], groupeKeys: string[]) {
  const byCompte: Record<string, { label: string; valeur: number; ecritures: LigneFEC[] }> = {}
  for (const groupeKey of groupeKeys) {
    const groupe = PCG_BILAN[groupeKey]
    if (!groupe) continue
    for (const g of groupe) {
      for (const l of lignes) {
        if (!g.prefixes.some(p => l.CompteNum.startsWith(p))) continue
        if (!byCompte[l.CompteNum]) byCompte[l.CompteNum] = { label: l.CompteLib || g.label, valeur: 0, ecritures: [] }
        byCompte[l.CompteNum].valeur += (l.Debit - l.Credit) * g.sign
        byCompte[l.CompteNum].ecritures.push(l)
      }
    }
  }
  return Object.entries(byCompte)
    .map(([num, d]) => ({ prefix: num, label: d.label, valeur: d.valeur, ecritures: d.ecritures }))
    .filter(s => Math.abs(s.valeur) > 0.5)
    .sort((a, b) => a.prefix.localeCompare(b.prefix))
}

function soldeKeys(lignes: LigneFEC[], keys: string[]): number {
  return getSousComptes(lignes, keys).reduce((s, c) => s + c.valeur, 0)
}

// Retourne uniquement les soldes positifs (actif) ou négatifs (passif) d'un groupe
function soldeActif(lignes: LigneFEC[], keys: string[]): number {
  return getSousComptes(lignes, keys).reduce((s, c) => s + Math.max(c.valeur, 0), 0)
}

function soldePassif(lignes: LigneFEC[], keys: string[]): number {
  return getSousComptes(lignes, keys).reduce((s, c) => s + Math.min(c.valeur, 0), 0)
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

function BilanLigne({ label, groupeKeys, lignes, panelData, setPanelData, color, indent, bold, isTotal, isSousTotal }: {
  label: string; groupeKeys: string[]; lignes: LigneFEC[]
  panelData: PanelData | null; setPanelData: (d: PanelData | null) => void
  color?: string; indent?: boolean; bold?: boolean; isTotal?: boolean; isSousTotal?: boolean
}) {
  const [open, setOpen] = useState(false)
  const sousComptes = useMemo(() => getSousComptes(lignes, groupeKeys), [lignes, groupeKeys])
  const valeur = sousComptes.reduce((s, c) => s + c.valeur, 0)
  const hasDetail = sousComptes.length > 0
  const maxVal = sousComptes.length > 0 ? Math.max(...sousComptes.map(s => Math.abs(s.valeur))) : 1

  if (Math.abs(valeur) < 0.5 && !isTotal && !isSousTotal) return null

  const c = color || '#1A1A1A'

  if (isTotal) return (
    <div style={{ display:'flex', alignItems:'center', padding:'11px 16px', background:'#1A1A1A', borderTop:'0.5px solid rgba(255,255,255,0.08)' }}>
      <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:500, color:'#B8A98A' }}>{fmt(valeur)}</div>
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
        <div style={{ fontSize:13, fontWeight:500, color: c }}>{fmt(valeur)}</div>
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
        <div style={{ fontSize:12, fontWeight: bold ? 500 : 400, color: c }}>{fmt(valeur)}</div>
      </div>
      {open && sousComptes.length > 0 && renderSousComptes(sousComptes, maxVal, panelData, setPanelData, c)}
    </>
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
  const rp = { lignes: lignesActives, panelData, setPanelData }

  // Totaux actif
  const totalImmobIncorp  = useMemo(() => soldeKeys(lignesActives, ['immobIncorpBrut','immobIncorpAmort']), [lignesActives])
  const totalImmobCorp    = useMemo(() => soldeKeys(lignesActives, ['immobCorpBrut','immobCorpAmort']), [lignesActives])
  const totalImmobFin     = useMemo(() => soldeKeys(lignesActives, ['immobFinBrut','immobFinProv']), [lignesActives])
  const totalActifImmo    = totalImmobIncorp + totalImmobCorp + totalImmobFin
  const totalStocks       = useMemo(() => soldeKeys(lignesActives, ['stocksMP','stocksEncours','stocksProduits','stocksMarchandises','provStocks']), [lignesActives])
  const totalCreances     = useMemo(() => soldeActif(lignesActives, ['creancesClients','provCreances','creancesEtat','autresCreances']), [lignesActives])
  const totalTresoA       = useMemo(() => soldeActif(lignesActives, ['vmp','banques','caisse','autresTresoA']), [lignesActives])
  const totalActifCirc    = totalStocks + totalCreances + totalTresoA + soldeKeys(lignesActives, ['chargesRepartir'])
  const totalActif        = totalActifImmo + totalActifCirc

  // Totaux passif
  const totalCapPropres   = useMemo(() => Math.abs(soldePassif(lignesActives, ['capital','reserves','reportANouveau','resultatN','subventionsInvest','provReglementees'])), [lignesActives])
  const totalProvRisques  = useMemo(() => Math.abs(soldePassif(lignesActives, ['provRisques','provCharges'])), [lignesActives])
  const totalDettesLT     = useMemo(() => Math.abs(soldePassif(lignesActives, ['empruntsOblig','empruntsEtab','autresEmprunts'])), [lignesActives])
  const totalDettesCT     = useMemo(() => Math.abs(soldePassif(lignesActives, ['dettesFourn','dettesSociales','dettesFiscales','autresDettes','concoursBancaires'])), [lignesActives])
  const totalDettes       = totalDettesLT + totalDettesCT
  const totalPassif       = totalCapPropres + totalProvRisques + totalDettes

  const ecart             = Math.abs(totalActif - Math.abs(totalPassif))
  const hasDesequilibre   = ecart > 1
  const hasData           = lignesActives.length > 0 && totalActif !== 0

  const indBilan = useMemo(() => {
    if (!lignesActives.length) return null
    const treso = soldeKeys(lignesActives, ['banques','caisse','autresTresoA'])
    const creances = soldeKeys(lignesActives, ['creancesClients'])
    const dettes = Math.abs(soldeKeys(lignesActives, ['dettesFourn']))
    return { treso, bfr: creances - dettes, ca: -lignesActives.filter(l => ['701','702','703','704','705','706','707','708'].some(p => l.CompteNum.startsWith(p))).reduce((s,l) => s + (l.Debit - l.Credit), 0) }
  }, [lignesActives])

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
            <div style={{ display:'flex', gap:16, alignItems:'flex-start', maxWidth:1400 }}>
              <div style={{ flex:1, minWidth:0 }}>
                {indBilan && <AlvioInsight payload={{ page:'balance-sheet', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ treso:indBilan.treso, bfr:indBilan.bfr, ca:indBilan.ca } }} />}

                {hasDesequilibre && (
                  <div style={{ background:'rgba(184,169,138,0.08)', border:'0.5px solid rgba(184,169,138,0.3)', borderLeft:'3px solid #B8A98A', borderRadius:'0 10px 10px 0', padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'flex-start', gap:10 }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>ℹ️</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:500, color:'#1A1A1A', marginBottom:3 }}>Bilan non équilibré — normal avec un FEC mono-exercice</div>
                      <div style={{ fontSize:11, color:'#8C9BAB', lineHeight:1.6 }}>Le FEC ne contient que les mouvements de l'exercice en cours. Les soldes d'ouverture des capitaux propres, immobilisations et résultats antérieurs ne sont pas inclus. Pour un bilan équilibré, il faut importer les FEC de tous les exercices précédents ou les à-nouveaux (comptes 890/891).</div>
                    </div>
                  </div>
                )}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

                  {/* ACTIF */}
                  <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                    <div style={{ background:'#1A1A1A', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.07em' }}>Actif</span>
                      <span style={{ fontSize:13, fontWeight:500, color:'#B8A98A' }}>{fmt(totalActif)}</span>
                    </div>

                    <Section title="Actif immobilisé" total={totalActifImmo} color="#8C9BAB" defaultOpen={true}>
                      {totalImmobIncorp !== 0 && (
                        <>
                          <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Incorporelles</div>
                          <BilanLigne label="Valeur brute" groupeKeys={['immobIncorpBrut']} color="#8C9BAB" indent {...rp} />
                          <BilanLigne label="Amortissements" groupeKeys={['immobIncorpAmort']} color="#D85A30" indent {...rp} />
                          <BilanLigne label="Immob. incorporelles nettes" groupeKeys={['immobIncorpBrut','immobIncorpAmort']} color="#8C9BAB" isSousTotal {...rp} />
                        </>
                      )}
                      {totalImmobCorp !== 0 && (
                        <>
                          <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Corporelles</div>
                          <BilanLigne label="Valeur brute" groupeKeys={['immobCorpBrut']} color="#8C9BAB" indent {...rp} />
                          <BilanLigne label="Amortissements" groupeKeys={['immobCorpAmort']} color="#D85A30" indent {...rp} />
                          <BilanLigne label="Immob. corporelles nettes" groupeKeys={['immobCorpBrut','immobCorpAmort']} color="#8C9BAB" isSousTotal {...rp} />
                        </>
                      )}
                      {totalImmobFin !== 0 && (
                        <>
                          <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Financières</div>
                          <BilanLigne label="Participations et prêts" groupeKeys={['immobFinBrut']} color="#5C6670" indent {...rp} />
                          <BilanLigne label="Provisions pour dépréciation" groupeKeys={['immobFinProv']} color="#D85A30" indent {...rp} />
                          <BilanLigne label="Immob. financières nettes" groupeKeys={['immobFinBrut','immobFinProv']} color="#5C6670" isSousTotal {...rp} />
                        </>
                      )}
                    </Section>

                    <Section title="Actif circulant" total={totalActifCirc} color="#B8A98A" defaultOpen={true}>
                      {totalStocks !== 0 && (
                        <>
                          <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Stocks</div>
                          <BilanLigne label="Matières premières et appros" groupeKeys={['stocksMP']} color="#B8A98A" indent {...rp} />
                          <BilanLigne label="En-cours de production" groupeKeys={['stocksEncours']} color="#B8A98A" indent {...rp} />
                          <BilanLigne label="Produits finis" groupeKeys={['stocksProduits']} color="#B8A98A" indent {...rp} />
                          <BilanLigne label="Marchandises" groupeKeys={['stocksMarchandises']} color="#B8A98A" indent {...rp} />
                          <BilanLigne label="Provisions pour dépréciation" groupeKeys={['provStocks']} color="#D85A30" indent {...rp} />
                          <BilanLigne label="Stocks nets" groupeKeys={['stocksMP','stocksEncours','stocksProduits','stocksMarchandises','provStocks']} color="#B8A98A" isSousTotal {...rp} />
                        </>
                      )}
                      {totalCreances !== 0 && (
                        <>
                          <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Créances</div>
                          <BilanLigne label="Clients et comptes rattachés" groupeKeys={['creancesClients']} color="#1A1A1A" indent {...rp} />
                          <BilanLigne label="Provisions créances douteuses" groupeKeys={['provCreances']} color="#D85A30" indent {...rp} />
                          <BilanLigne label="Créances fiscales (État)" groupeKeys={['creancesEtat']} color="#1A1A1A" indent {...rp} />
                          <BilanLigne label="Autres créances" groupeKeys={['autresCreances']} color="#8C9BAB" indent {...rp} />
                          <BilanLigne label="Créances nettes" groupeKeys={['creancesClients','provCreances','creancesEtat','autresCreances']} color="#1A1A1A" isSousTotal {...rp} />
                        </>
                      )}
                      <BilanLigne label="Valeurs mobilières de placement" groupeKeys={['vmp']} color="#5C6670" indent {...rp} />
                      {totalTresoA !== 0 && (
                        <>
                          <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Trésorerie</div>
                          <BilanLigne label="Banques et CCP" groupeKeys={['banques']} color="#1D9E75" indent {...rp} />
                          <BilanLigne label="Caisse" groupeKeys={['caisse']} color="#1D9E75" indent {...rp} />
                          <BilanLigne label="Valeurs à l'encaissement" groupeKeys={['autresTresoA']} color="#1D9E75" indent {...rp} />
                          <BilanLigne label="Total disponibilités" groupeKeys={['banques','caisse','autresTresoA']} color="#1D9E75" isSousTotal {...rp} />
                        </>
                      )}
                      <BilanLigne label="Charges à répartir" groupeKeys={['chargesRepartir']} color="#8C9BAB" indent {...rp} />
                    </Section>

                    <BilanLigne label="Total actif" groupeKeys={['immobIncorpBrut','immobIncorpAmort','immobCorpBrut','immobCorpAmort','immobFinBrut','immobFinProv','stocksMP','stocksEncours','stocksProduits','stocksMarchandises','provStocks','creancesClients','provCreances','creancesEtat','autresCreances','vmp','banques','caisse','autresTresoA','chargesRepartir']} isTotal {...rp} />
                  </div>

                  {/* PASSIF */}
                  <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                    <div style={{ background:'#1A1A1A', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.07em' }}>Passif</span>
                      <span style={{ fontSize:13, fontWeight:500, color:'#B8A98A' }}>{fmt(Math.abs(totalPassif))}</span>
                    </div>

                    <Section title="Capitaux propres" total={Math.abs(totalCapPropres)} color="#1D9E75" defaultOpen={true}>
                      <BilanLigne label="Capital et primes d'émission" groupeKeys={['capital']} color="#1D9E75" indent {...rp} />
                      <BilanLigne label="Réserves" groupeKeys={['reserves']} color="#1D9E75" indent {...rp} />
                      <BilanLigne label="Report à nouveau" groupeKeys={['reportANouveau']} color="#1D9E75" indent {...rp} />
                      <BilanLigne label="Résultat de l'exercice" groupeKeys={['resultatN']} color="#1D9E75" indent {...rp} />
                      <BilanLigne label="Subventions d'investissement" groupeKeys={['subventionsInvest']} color="#8C9BAB" indent {...rp} />
                      <BilanLigne label="Provisions réglementées" groupeKeys={['provReglementees']} color="#8C9BAB" indent {...rp} />
                    </Section>

                    {Math.abs(totalProvRisques) > 0.5 && (
                      <Section title="Provisions pour risques et charges" total={Math.abs(totalProvRisques)} color="#D85A30" defaultOpen={true}>
                        <BilanLigne label="Provisions pour risques" groupeKeys={['provRisques']} color="#D85A30" indent {...rp} />
                        <BilanLigne label="Provisions pour charges" groupeKeys={['provCharges']} color="#D85A30" indent {...rp} />
                      </Section>
                    )}

                    <Section title="Dettes" total={Math.abs(totalDettes)} color="#D85A30" defaultOpen={true}>
                      {Math.abs(totalDettesLT) > 0.5 && (
                        <>
                          <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Dettes financières</div>
                          <BilanLigne label="Emprunts obligataires" groupeKeys={['empruntsOblig']} color="#D85A30" indent {...rp} />
                          <BilanLigne label="Emprunts établissements de crédit" groupeKeys={['empruntsEtab']} color="#D85A30" indent {...rp} />
                          <BilanLigne label="Autres emprunts et dettes" groupeKeys={['autresEmprunts']} color="#D85A30" indent {...rp} />
                          <BilanLigne label="Total dettes financières" groupeKeys={['empruntsOblig','empruntsEtab','autresEmprunts']} color="#D85A30" isSousTotal {...rp} />
                        </>
                      )}
                      <div style={{ padding:'7px 16px 3px', fontSize:10, fontWeight:600, color:'#B8A98A', textTransform:'uppercase', letterSpacing:'0.06em', background:'rgba(184,169,138,0.04)' }}>Dettes d'exploitation</div>
                      <BilanLigne label="Fournisseurs et comptes rattachés" groupeKeys={['dettesFourn']} color="#D85A30" indent {...rp} />
                      <BilanLigne label="Dettes sociales (personnel, URSSAF)" groupeKeys={['dettesSociales']} color="#D85A30" indent {...rp} />
                      <BilanLigne label="Dettes fiscales (IS, TVA)" groupeKeys={['dettesFiscales']} color="#D85A30" indent {...rp} />
                      <BilanLigne label="Autres dettes" groupeKeys={['autresDettes']} color="#8C9BAB" indent {...rp} />
                      <BilanLigne label="Concours bancaires courants" groupeKeys={['concoursBancaires']} color="#993C1D" indent {...rp} />
                    </Section>

                    <BilanLigne label="Total passif" groupeKeys={['capital','reserves','reportANouveau','resultatN','subventionsInvest','provReglementees','provRisques','provCharges','empruntsOblig','empruntsEtab','autresEmprunts','dettesFourn','dettesSociales','dettesFiscales','autresDettes','concoursBancaires']} isTotal {...rp} />
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
