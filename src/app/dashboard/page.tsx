'use client'

import { useState, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigneFEC {
  JournalCode: string
  EcritureDate: string
  CompteNum: string
  CompteLib: string
  Debit: number
  Credit: number
  EcritureLib: string
  PieceRef: string
}

interface SoldeCompte {
  num: string
  lib: string
  solde: number // positif = débiteur, négatif = créditeur
  debit: number
  credit: number
}

interface IndicateursFinanciers {
  ca: number
  achatsMatieres: number
  margeCommerciale: number
  productionVendue: number
  productionImmobilisee: number
  margebrute: number
  tauxMargebrute: number
  valeurAjoutee: number
  subventionsExploitation: number
  chargesPersonnel: number
  impotsTaxes: number
  ebe: number
  tauxEbe: number
  dotationsAmort: number
  rex: number
  resultatFinancier: number
  resultatExceptionnel: number
  impotsSocietes: number
  resultatNet: number
  tauxResultatNet: number
  caf: number
  chargesExternes: number
}

interface DrillData {
  niveau: 1 | 2
  titre: string
  comptes?: SoldeCompte[]
  lignes?: LigneFEC[]
  compteNum?: string
}

// ─── Parseur FEC ──────────────────────────────────────────────────────────────

function parseFEC(texte: string): LigneFEC[] {
  const lignes = texte.split(/\r?\n/).filter(l => l.trim())
  if (lignes.length < 2) return []

  // Détection du séparateur : | ou \t ou ;
  const premiereLigne = lignes[0]
  const sep = premiereLigne.includes('|') ? '|' : premiereLigne.includes('\t') ? '\t' : ';'

  const headers = premiereLigne.split(sep).map(h => h.trim().replace(/^"(.+)"$/, '$1'))

  const idx = (nom: string) => {
    const i = headers.findIndex(h => h.toLowerCase() === nom.toLowerCase())
    return i >= 0 ? i : -1
  }

  const iJournalCode   = idx('JournalCode')
  const iEcritureDate  = idx('EcritureDate')
  const iCompteNum     = idx('CompteNum')
  const iCompteLib     = idx('CompteLib')
  const iDebit         = idx('Debit')
  const iCredit        = idx('Credit')
  const iEcritureLib   = idx('EcritureLib')
  const iPieceRef      = idx('PieceRef')

  const result: LigneFEC[] = []

  for (let i = 1; i < lignes.length; i++) {
    const cols = lignes[i].split(sep).map(c => c.trim().replace(/^"(.+)"$/, '$1'))
    if (cols.length < 5) continue

    const debitStr  = iDebit  >= 0 ? cols[iDebit]  : '0'
    const creditStr = iCredit >= 0 ? cols[iCredit] : '0'

    const parseNum = (s: string) => {
      if (!s) return 0
      return parseFloat(s.replace(',', '.').replace(/\s/g, '')) || 0
    }

    result.push({
      JournalCode:  iJournalCode  >= 0 ? cols[iJournalCode]  : '',
      EcritureDate: iEcritureDate >= 0 ? cols[iEcritureDate] : '',
      CompteNum:    iCompteNum    >= 0 ? cols[iCompteNum]    : '',
      CompteLib:    iCompteLib    >= 0 ? cols[iCompteLib]    : '',
      Debit:        parseNum(debitStr),
      Credit:       parseNum(creditStr),
      EcritureLib:  iEcritureLib  >= 0 ? cols[iEcritureLib]  : '',
      PieceRef:     iPieceRef     >= 0 ? cols[iPieceRef]     : '',
    })
  }

  return result
}

// ─── Calcul des soldes par racine PCG ─────────────────────────────────────────

function soldesParRacine(lignes: LigneFEC[], racines: string[]): number {
  // Pour les comptes de gestion : solde = Débit - Crédit
  // Charges (6x) → solde débiteur = montant positif = charge
  // Produits (7x) → solde créditeur = montant positif = produit (on retourne le signe)
  let total = 0
  for (const l of lignes) {
    for (const r of racines) {
      if (l.CompteNum.startsWith(r)) {
        total += l.Debit - l.Credit
        break
      }
    }
  }
  return total
}

function getSoldesComptes(lignes: LigneFEC[], racines: string[]): SoldeCompte[] {
  const map = new Map<string, SoldeCompte>()
  for (const l of lignes) {
    for (const r of racines) {
      if (l.CompteNum.startsWith(r)) {
        const existing = map.get(l.CompteNum)
        if (existing) {
          existing.debit  += l.Debit
          existing.credit += l.Credit
          existing.solde   = existing.debit - existing.credit
        } else {
          map.set(l.CompteNum, {
            num:    l.CompteNum,
            lib:    l.CompteLib || l.CompteNum,
            debit:  l.Debit,
            credit: l.Credit,
            solde:  l.Debit - l.Credit,
          })
        }
        break
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.num.localeCompare(b.num))
}

function calculerIndicateurs(lignes: LigneFEC[]): IndicateursFinanciers {
  // Produits
  const ventes701  = -soldesParRacine(lignes, ['701', '702', '703', '704', '705', '706', '707', '708'])
  const prod71     = -soldesParRacine(lignes, ['71'])
  const prod72     = -soldesParRacine(lignes, ['72'])
  const subv74     = -soldesParRacine(lignes, ['74'])
  const autres75   = -soldesParRacine(lignes, ['75'])

  // Achats
  const achats60   = soldesParRacine(lignes, ['601', '602', '603', '604', '605', '606', '607', '608', '609'])
  const variation60= soldesParRacine(lignes, ['6031', '6032', '6037'])

  // Charges
  const ext61      = soldesParRacine(lignes, ['61'])
  const ext62      = soldesParRacine(lignes, ['62'])
  const imp63      = soldesParRacine(lignes, ['63'])
  const pers64     = soldesParRacine(lignes, ['64'])
  const dot68      = soldesParRacine(lignes, ['681', '686', '687'])
  const finChg66   = soldesParRacine(lignes, ['66'])
  const finProd76  = -soldesParRacine(lignes, ['76'])
  const excChg67   = soldesParRacine(lignes, ['67'])
  const excProd77  = -soldesParRacine(lignes, ['77'])
  const is695      = soldesParRacine(lignes, ['695', '696', '697', '698', '699'])

  const ca               = ventes701
  const achatsMatieres   = achats60 + variation60
  const margeCommerciale = ca - achatsMatieres
  const productionVendue = ventes701
  const productionImmob  = prod72
  const chargesExternes  = ext61 + ext62
  const margebrute       = ca + prod71 + prod72 - achatsMatieres - chargesExternes
  const tauxMargebrute   = ca > 0 ? (margebrute / ca) * 100 : 0
  const valeurAjoutee    = margebrute + subv74 + autres75 - imp63
  const ebe              = valeurAjoutee - pers64
  const tauxEbe          = ca > 0 ? (ebe / ca) * 100 : 0
  const rex              = ebe - dot68
  const resultatFinancier    = finProd76 - finChg66
  const resultatExceptionnel = excProd77 - excChg67
  const resultatNet          = rex + resultatFinancier + resultatExceptionnel - is695
  const tauxResultatNet      = ca > 0 ? (resultatNet / ca) * 100 : 0
  const caf                  = resultatNet + dot68

  return {
    ca, achatsMatieres, margeCommerciale,
    productionVendue, productionImmobilisee: productionImmob,
    margebrute, tauxMargebrute,
    chargesExternes,
    valeurAjoutee,
    subventionsExploitation: subv74,
    chargesPersonnel: pers64,
    impotsTaxes: imp63,
    ebe, tauxEbe,
    dotationsAmort: dot68,
    rex,
    resultatFinancier,
    resultatExceptionnel,
    impotsSocietes: is695,
    resultatNet, tauxResultatNet,
    caf,
  }
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'

const fmtPct = (n: number) =>
  (Math.round(n * 10) / 10).toFixed(1) + ' %'

const deltaColor = (n: number) =>
  n > 0 ? '#1D9E75' : n < 0 ? '#D85A30' : '#8C9BAB'

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [lignes, setLignes]         = useState<LigneFEC[] | null>(null)
  const [indicateurs, setIndicateurs] = useState<IndicateursFinanciers | null>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [nbLignes, setNbLignes]     = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [erreur, setErreur]         = useState('')
  const [drill, setDrill]           = useState<DrillData | null>(null)
  const [periodeTab, setPeriodeTab] = useState<'mois' | 'exercice'>('exercice')
  const fileRef = useRef<HTMLInputElement>(null)

  const traiterFichier = useCallback((file: File) => {
    setErreur('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const texte = e.target?.result as string
      const parsed = parseFEC(texte)
      if (parsed.length === 0) {
        setErreur('Fichier non reconnu. Vérifiez qu'il s'agit bien d'un FEC (séparateur | ou tabulation, colonnes JournalCode, CompteNum, Debit, Credit…)')
        return
      }
      const ind = calculerIndicateurs(parsed)
      setLignes(parsed)
      setIndicateurs(ind)
      setNomFichier(file.name)
      setNbLignes(parsed.length)
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) traiterFichier(file)
  }, [traiterFichier])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) traiterFichier(file)
  }

  const openDrill1 = (titre: string, racines: string[]) => {
    if (!lignes) return
    const comptes = getSoldesComptes(lignes, racines)
    setDrill({ niveau: 1, titre, comptes })
  }

  const openDrill2 = (compteNum: string, compteLib: string) => {
    if (!lignes) return
    const lignesCompte = lignes.filter(l => l.CompteNum === compteNum)
    setDrill({ niveau: 2, titre: `${compteNum} — ${compteLib}`, lignes: lignesCompte, compteNum })
  }

  // ── Rendu : état vide ──────────────────────────────────────────────────────

  if (!indicateurs) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Topbar titre="KPIs & SIG" periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} hasData={false} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
            <div style={{ maxWidth: 560, width: '100%' }}>

              {/* Zone import principale */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? '#B8A98A' : 'rgba(184,169,138,0.4)'}`,
                  borderRadius: 16,
                  padding: '48px 40px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging ? 'rgba(184,169,138,0.05)' : '#fff',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 12,
                  background: 'rgba(184,169,138,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>
                  Déposez votre FEC ici
                </div>
                <div style={{ fontSize: 13, color: '#8C9BAB', marginBottom: 20 }}>
                  ou cliquez pour sélectionner le fichier
                </div>
                <div style={{
                  display: 'inline-block',
                  background: '#1A1A1A', color: '#F2F3F5',
                  fontSize: 13, fontWeight: 500,
                  padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
                }}>
                  Choisir un fichier FEC
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv,.tsv"
                  style={{ display: 'none' }}
                  onChange={onFileChange}
                />
              </div>

              {erreur && (
                <div style={{
                  marginTop: 16, padding: '12px 16px',
                  background: 'rgba(216,90,48,0.08)',
                  borderRadius: 8, fontSize: 13, color: '#993C1D',
                  border: '0.5px solid rgba(216,90,48,0.2)',
                }}>
                  ⚠ {erreur}
                </div>
              )}

              {/* Aide format */}
              <div style={{
                marginTop: 24, padding: '16px 20px',
                background: '#fff', borderRadius: 12,
                border: '0.5px solid rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>
                  Format FEC attendu
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['Séparateur', '| ou tabulation ou ;'],
                    ['Encodage', 'UTF-8 ou Latin-1'],
                    ['Colonnes requises', 'JournalCode, CompteNum'],
                    ['Colonnes requises', 'Debit, Credit'],
                    ['Extension', '.txt · .csv · .tsv'],
                    ['Source', 'Export FEC de votre logiciel'],
                  ].map(([k, v], i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 10, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</span>
                      <span style={{ fontSize: 12, color: '#1A1A1A' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lien Pennylane futur */}
              <div style={{
                marginTop: 12, padding: '12px 16px',
                background: '#fff', borderRadius: 10,
                border: '0.5px solid rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#F2F3F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C9BAB" strokeWidth="1.5">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>Connexion Pennylane</div>
                  <div style={{ fontSize: 11, color: '#8C9BAB', fontStyle: 'italic' }}>Synchronisation automatique — bientôt disponible</div>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 500, padding: '3px 8px',
                  background: 'rgba(184,169,138,0.12)', color: '#B8A98A',
                  borderRadius: 4,
                }}>Bientôt</div>
              </div>

            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Rendu : dashboard avec données ────────────────────────────────────────

  const ind = indicateurs

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          titre="KPIs & SIG"
          periodeTab={periodeTab}
          setPeriodeTab={setPeriodeTab}
          hasData={true}
          nomFichier={nomFichier}
          nbLignes={nbLignes}
          onReset={() => { setLignes(null); setIndicateurs(null); setNomFichier(''); setDrill(null) }}
        />

        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>

          {/* ── KPI row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard
              label="Chiffre d'affaires"
              value={fmt(ind.ca)}
              sub={`Projeté N : ${fmt(ind.ca * (12 / new Date().getMonth() || 1))}`}
              accent="#B8A98A"
            />
            <KpiCard
              label="Marge brute"
              value={fmt(ind.margebrute)}
              sub={`Taux : ${fmtPct(ind.tauxMargebrute)} du CA`}
              subBold
              accent="#B8A98A"
            />
            <KpiCard
              label="EBITDA"
              value={fmt(ind.ebe)}
              sub={`Taux : ${fmtPct(ind.tauxEbe)} du CA`}
              subBold
              accent={ind.tauxEbe >= 10 ? '#1D9E75' : '#D85A30'}
            />
            <KpiCard
              label="Résultat net"
              value={fmt(ind.resultatNet)}
              sub={`Taux : ${fmtPct(ind.tauxResultatNet)} du CA`}
              subBold
              accent={ind.resultatNet >= 0 ? '#B8A98A' : '#D85A30'}
            />
          </div>

          {/* ── SIG + Ratios ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

            {/* SIG */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '14px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>
                  Soldes intermédiaires de gestion
                </div>
                <div style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic' }}>Base grand livre PCG · {nbLignes.toLocaleString('fr-FR')} lignes</div>
              </div>
              <div style={{ padding: '8px 18px 4px' }}>
                <div style={{ fontSize: 10, color: '#B8A98A', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Cliquer sur une ligne pour voir le détail des comptes
                </div>
              </div>
              <div style={{ padding: '0 18px 16px' }}>

                <SigLigne
                  nom="Production vendue"
                  codes="70x · 71x · 72x"
                  valeur={ind.productionVendue}
                  pct={ind.ca > 0 ? (ind.productionVendue / ind.ca) * 100 : 0}
                  bold
                  onClick={() => openDrill1('Production vendue', ['70', '71', '72'])}
                />
                {ind.achatsMatieres > 0 && (
                  <SigLigne
                    nom="Achats & variation de stocks"
                    codes="60x"
                    valeur={-ind.achatsMatieres}
                    pct={ind.ca > 0 ? (-ind.achatsMatieres / ind.ca) * 100 : 0}
                    onClick={() => openDrill1('Achats & variation de stocks', ['601', '602', '603', '604', '605', '606', '607', '608', '609'])}
                  />
                )}
                <SigLigne
                  nom="Charges externes"
                  codes="61x · 62x"
                  valeur={-ind.chargesExternes}
                  pct={ind.ca > 0 ? (-ind.chargesExternes / ind.ca) * 100 : 0}
                  onClick={() => openDrill1('Charges externes', ['61', '62'])}
                />

                <SigTotal
                  nom="Marge brute"
                  valeur={ind.margebrute}
                  pct={ind.tauxMargebrute}
                />

                <div style={{ height: 1, background: '#F2F3F5', margin: '8px 0' }} />

                <SigLigne
                  nom="Impôts & taxes"
                  codes="63x"
                  valeur={-ind.impotsTaxes}
                  pct={ind.ca > 0 ? (-ind.impotsTaxes / ind.ca) * 100 : 0}
                  onClick={() => openDrill1('Impôts & taxes', ['63'])}
                />
                <SigLigne
                  nom="Charges de personnel"
                  codes="64x"
                  valeur={-ind.chargesPersonnel}
                  pct={ind.ca > 0 ? (-ind.chargesPersonnel / ind.ca) * 100 : 0}
                  alert={ind.ca > 0 && (ind.chargesPersonnel / ind.ca) > 0.5}
                  onClick={() => openDrill1('Charges de personnel', ['64'])}
                />

                <SigTotal
                  nom="EBE (Excédent Brut d'Exploitation)"
                  valeur={ind.ebe}
                  pct={ind.tauxEbe}
                />

                <div style={{ height: 1, background: '#F2F3F5', margin: '8px 0' }} />

                <SigLigne
                  nom="Dotations aux amortissements"
                  codes="68x"
                  valeur={-ind.dotationsAmort}
                  pct={ind.ca > 0 ? (-ind.dotationsAmort / ind.ca) * 100 : 0}
                  onClick={() => openDrill1('Dotations amortissements', ['681', '686', '687'])}
                />
                <SigLigne
                  nom="Résultat financier"
                  codes="66x · 76x"
                  valeur={ind.resultatFinancier}
                  pct={ind.ca > 0 ? (ind.resultatFinancier / ind.ca) * 100 : 0}
                  onClick={() => openDrill1('Résultat financier', ['66', '76'])}
                />
                <SigLigne
                  nom="Résultat exceptionnel"
                  codes="67x · 77x"
                  valeur={ind.resultatExceptionnel}
                  pct={ind.ca > 0 ? (ind.resultatExceptionnel / ind.ca) * 100 : 0}
                  onClick={() => openDrill1('Résultat exceptionnel', ['67', '77'])}
                />
                <SigLigne
                  nom="Impôts sur les bénéfices"
                  codes="695x"
                  valeur={-ind.impotsSocietes}
                  pct={ind.ca > 0 ? (-ind.impotsSocietes / ind.ca) * 100 : 0}
                  onClick={() => openDrill1('Impôts sur les bénéfices', ['695', '696', '697', '698', '699'])}
                />

                <SigTotal
                  nom="Résultat net"
                  valeur={ind.resultatNet}
                  pct={ind.tauxResultatNet}
                  large
                />

              </div>
            </div>

            {/* Ratios + Analyse */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Ratios */}
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 14 }}>Ratios clés</div>
                {[
                  { label: 'Taux de marge brute', value: ind.tauxMargebrute, ref: 'secteur ~55–70 %', max: 100, warn: ind.tauxMargebrute < 30 },
                  { label: 'Taux d\'EBE / CA', value: ind.tauxEbe, ref: 'objectif > 10 %', max: 30, warn: ind.tauxEbe < 10 },
                  { label: 'Charges personnel / CA', value: ind.ca > 0 ? (ind.chargesPersonnel / ind.ca) * 100 : 0, ref: 'seuil alerte 50 %', max: 80, warn: ind.ca > 0 && (ind.chargesPersonnel / ind.ca) > 0.5, inverse: true },
                  { label: 'Taux de résultat net', value: ind.tauxResultatNet, ref: 'objectif > 5 %', max: 20, warn: ind.tauxResultatNet < 5 },
                  { label: 'CAF / CA', value: ind.ca > 0 ? (ind.caf / ind.ca) * 100 : 0, ref: 'résultat net + amort.', max: 20 },
                ].map((r, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#8C9BAB' }}>{r.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: r.warn ? '#D85A30' : '#1A1A1A' }}>
                          {fmtPct(r.value)}
                        </span>
                        <span style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic' }}>{r.ref}</span>
                      </div>
                    </div>
                    <div style={{ height: 3, background: '#F2F3F5', borderRadius: 2 }}>
                      <div style={{
                        height: 3, borderRadius: 2,
                        width: `${Math.min(Math.abs(r.value) / r.max * 100, 100)}%`,
                        background: r.warn ? '#D85A30' : '#B8A98A',
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Analyse automatique */}
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px', flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>Analyse Alvio</div>
                <AnalyseAuto ind={ind} />
              </div>

            </div>
          </div>

          {/* ── Bottom row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

            {/* Masse salariale */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>Masse salariale</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A' }}>{fmt(ind.chargesPersonnel)}</div>
              <div style={{ fontSize: 11, color: '#8C9BAB', fontStyle: 'italic', marginTop: 2 }}>
                dont <strong style={{ color: ind.ca > 0 && (ind.chargesPersonnel / ind.ca) > 0.5 ? '#D85A30' : '#1A1A1A', fontStyle: 'normal' }}>
                  {fmtPct(ind.ca > 0 ? (ind.chargesPersonnel / ind.ca) * 100 : 0)} du CA
                </strong>
              </div>
              <div style={{ marginTop: 12 }}>
                {[
                  ['Charges externes', fmt(ind.chargesExternes)],
                  ['CAF', fmt(ind.caf)],
                  ['Résultat d\'exploitation', fmt(ind.rex)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: 11, color: '#8C9BAB' }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Point mort */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>Point mort</div>
              {(() => {
                const chargesFixes = ind.chargesPersonnel + ind.chargesExternes + ind.impotsTaxes
                const tauxMarge = ind.ca > 0 ? ind.margebrute / ind.ca : 0
                const pointMort = tauxMarge > 0 ? chargesFixes / tauxMarge : 0
                const margeSec = ind.ca - pointMort
                const couverture = pointMort > 0 ? (ind.ca / pointMort) * 100 : 0
                return (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A' }}>{fmt(pointMort)}</div>
                    <div style={{ fontSize: 11, color: '#8C9BAB', fontStyle: 'italic', marginTop: 2 }}>CA seuil de rentabilité</div>
                    <div style={{ marginTop: 12 }}>
                      {[
                        ['CA réalisé', fmt(ind.ca)],
                        ['Marge de sécurité', fmt(margeSec)],
                        ['Couverture', `${Math.round(couverture)} %`],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                          <span style={{ fontSize: 11, color: '#8C9BAB' }}>{k}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: margeSec > 0 ? '#1D9E75' : '#D85A30' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Source données */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>Source des données</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(29,158,117,0.08)', borderRadius: 8, padding: '8px 12px', marginBottom: 12,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{ fontSize: 12, color: '#0F6E56', fontWeight: 500 }}>FEC importé</span>
              </div>
              <div style={{ fontSize: 11, color: '#8C9BAB', lineHeight: 1.7 }}>
                <div><strong style={{ color: '#1A1A1A', fontWeight: 500 }}>{nomFichier}</strong></div>
                <div>{nbLignes.toLocaleString('fr-FR')} écritures analysées</div>
              </div>
              <button
                onClick={() => { setLignes(null); setIndicateurs(null); setNomFichier(''); setDrill(null) }}
                style={{
                  marginTop: 12, width: '100%',
                  background: 'transparent', border: '0.5px solid rgba(0,0,0,0.15)',
                  borderRadius: 6, padding: '7px 0', fontSize: 12, color: '#1A1A1A',
                  cursor: 'pointer',
                }}
              >
                Importer un autre fichier
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── Drill-down overlay ── */}
      {drill && (
        <DrillPanel
          drill={drill}
          onClose={() => setDrill(null)}
          onDrill2={openDrill2}
          onBack={() => setDrill(d => d && d.niveau === 2 ? { ...d, niveau: 1 } : null)}
        />
      )}

    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Sidebar() {
  const items = [
    { icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', label: 'KPIs & SIG', active: true },
    { icon: 'M3 3v18h18M7 16l4-4 4 4 5-5', label: 'Trésorerie', active: false },
    { icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', label: 'Prévisionnel', active: false },
    { icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', label: 'Simulations', active: false },
    { icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12', label: 'Export', active: false },
  ]
  return (
    <div style={{ width: 216, minWidth: 216, background: '#1A1A1A', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid rgba(184,169,138,0.18)' }}>
        <div style={{ color: '#B8A98A', fontSize: 15, fontWeight: 500, letterSpacing: '0.05em' }}>Alvio</div>
        <div style={{ color: '#8C9BAB', fontSize: 9, marginTop: 3, letterSpacing: '0.03em' }}>Intelligence financière en temps réel</div>
      </div>
      <div style={{ flex: 1, padding: '10px 0' }}>
        <div style={{ padding: '10px 20px 4px', color: 'rgba(140,155,171,0.5)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Analyse</div>
        {items.map((item) => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: item.active ? '8px 18px 8px 18px' : '8px 20px',
            borderLeft: item.active ? '2px solid #B8A98A' : '2px solid transparent',
            background: item.active ? 'rgba(184,169,138,0.1)' : 'transparent',
            color: item.active ? '#B8A98A' : '#8C9BAB',
            fontSize: 12, cursor: 'pointer',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            {item.label}
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(184,169,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8A98A', fontSize: 10, fontWeight: 500 }}>
          AB
        </div>
        <div>
          <div style={{ color: '#F2F3F5', fontSize: 12, fontWeight: 500 }}>Mon compte</div>
          <div style={{ color: '#8C9BAB', fontSize: 9 }}>Bêta</div>
        </div>
      </div>
    </div>
  )
}

function Topbar({ titre, periodeTab, setPeriodeTab, hasData, nomFichier, nbLignes, onReset }: {
  titre: string
  periodeTab: 'mois' | 'exercice'
  setPeriodeTab: (v: 'mois' | 'exercice') => void
  hasData: boolean
  nomFichier?: string
  nbLignes?: number
  onReset?: () => void
}) {
  return (
    <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>{titre}</span>
        {hasData && (
          <div style={{ display: 'flex', background: '#F2F3F5', borderRadius: 6, padding: 2, gap: 2 }}>
            {(['mois', 'exercice'] as const).map(t => (
              <div key={t} onClick={() => setPeriodeTab(t)} style={{
                padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: periodeTab === t ? '#fff' : 'transparent',
                color: periodeTab === t ? '#1A1A1A' : '#8C9BAB',
                boxShadow: periodeTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                {t === 'mois' ? 'Ce mois' : 'Exercice'}
              </div>
            ))}
          </div>
        )}
      </div>
      {hasData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#8C9BAB', fontStyle: 'italic' }}>
            {nomFichier} · {nbLignes?.toLocaleString('fr-FR')} lignes
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, subBold, accent }: {
  label: string; value: string; sub: string; subBold?: boolean; accent: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '0.5px solid rgba(0,0,0,0.06)', borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8C9BAB', marginTop: 4, fontStyle: 'italic' }}>
        {subBold ? (
          <strong style={{ color: '#1A1A1A', fontStyle: 'normal', fontWeight: 500 }}>{sub.split(':')[0]}: </strong>
        ) : null}
        {subBold ? sub.split(':').slice(1).join(':') : sub}
      </div>
    </div>
  )
}

function SigLigne({ nom, codes, valeur, pct, bold, alert, onClick }: {
  nom: string; codes: string; valeur: number; pct: number; bold?: boolean; alert?: boolean; onClick?: () => void
}) {
  const isPos = valeur > 0
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', padding: '6px 4px',
        borderBottom: '0.5px solid rgba(0,0,0,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 4,
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.background = '#F7F8FA')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
    >
      <div style={{ flex: 1, fontSize: bold ? 13 : 12, fontWeight: bold ? 500 : 400, color: alert ? '#D85A30' : '#1A1A1A' }}>
        {nom} <span style={{ fontSize: 9, color: '#B8A98A', fontWeight: 400 }}>{codes}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: bold ? 500 : 400, color: isPos ? '#1A1A1A' : '#D85A30', minWidth: 90, textAlign: 'right' }}>
        {isPos ? '' : ''}{fmt(valeur)}
      </div>
      <div style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic', minWidth: 48, textAlign: 'right' }}>
        {fmtPct(pct)}
      </div>
    </div>
  )
}

function SigTotal({ nom, valeur, pct, large }: { nom: string; valeur: number; pct: number; large?: boolean }) {
  const isPos = valeur >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 4px 3px', borderTop: `${large ? 2 : 1}px solid ${large ? '#1A1A1A' : 'rgba(0,0,0,0.15)'}`, marginTop: 4 }}>
      <div style={{ flex: 1, fontSize: large ? 14 : 13, fontWeight: 500, color: isPos ? '#1D9E75' : '#D85A30' }}>{nom}</div>
      <div style={{ fontSize: large ? 16 : 14, fontWeight: 500, color: isPos ? '#1D9E75' : '#D85A30', minWidth: 90, textAlign: 'right' }}>{fmt(valeur)}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: isPos ? '#1D9E75' : '#D85A30', fontStyle: 'italic', minWidth: 48, textAlign: 'right' }}>{fmtPct(pct)}</div>
    </div>
  )
}

function AnalyseAuto({ ind }: { ind: IndicateursFinanciers }) {
  const points: { txt: string; warn: boolean }[] = []

  if (ind.ca > 0) {
    if (ind.tauxMargebrute > 60) points.push({ txt: `Marge brute solide à ${fmtPct(ind.tauxMargebrute)}.`, warn: false })
    else if (ind.tauxMargebrute < 30) points.push({ txt: `Marge brute faible à ${fmtPct(ind.tauxMargebrute)} — achats à revoir.`, warn: true })

    if (ind.tauxEbe >= 10) points.push({ txt: `Taux d'EBE correct à ${fmtPct(ind.tauxEbe)} du CA.`, warn: false })
    else points.push({ txt: `EBE sous 10 % (${fmtPct(ind.tauxEbe)}) — structure de coûts à optimiser.`, warn: true })

    const pctPers = (ind.chargesPersonnel / ind.ca) * 100
    if (pctPers > 50) points.push({ txt: `Masse salariale élevée : ${fmtPct(pctPers)} du CA. Seuil d'alerte à 50 %.`, warn: true })
    else if (pctPers < 30) points.push({ txt: `Charges de personnel maîtrisées à ${fmtPct(pctPers)} du CA.`, warn: false })

    if (ind.resultatNet < 0) points.push({ txt: `Résultat net négatif (${fmt(ind.resultatNet)}) — situation déficitaire.`, warn: true })
    else if (ind.tauxResultatNet > 5) points.push({ txt: `Bonne rentabilité nette à ${fmtPct(ind.tauxResultatNet)} du CA.`, warn: false })
  }

  if (points.length === 0) {
    return <div style={{ fontSize: 12, color: '#8C9BAB', fontStyle: 'italic' }}>Analyse disponible après import des données.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {points.map((p, i) => (
        <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: p.warn ? '#993C1D' : '#1A1A1A' }}>
          {p.warn
            ? <><strong style={{ fontWeight: 500 }}>⚠ </strong><em style={{ fontStyle: 'normal' }}>{p.txt}</em></>
            : <><strong style={{ fontWeight: 500, color: '#0F6E56' }}>✓ </strong>{p.txt}</>
          }
        </div>
      ))}
    </div>
  )
}

function DrillPanel({ drill, onClose, onDrill2, onBack }: {
  drill: DrillData
  onClose: () => void
  onDrill2: (num: string, lib: string) => void
  onBack: () => void
}) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: '#fff', zIndex: 50, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {drill.niveau === 2 && (
            <button onClick={onBack} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Retour
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>{drill.titre}</div>
            <div style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic', marginTop: 2 }}>
              {drill.niveau === 1 ? 'Détail par compte — cliquer pour voir les écritures' : 'Écritures du grand livre'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8C9BAB', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>

          {/* Niveau 1 : liste des comptes */}
          {drill.niveau === 1 && drill.comptes && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compte</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Libellé</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Débit</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Crédit</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solde</th>
                </tr>
              </thead>
              <tbody>
                {drill.comptes.map(c => (
                  <tr
                    key={c.num}
                    onClick={() => onDrill2(c.num, c.lib)}
                    style={{ borderBottom: '0.5px solid rgba(0,0,0,0.04)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '7px 4px', fontWeight: 500, color: '#B8A98A' }}>{c.num}</td>
                    <td style={{ padding: '7px 4px', color: '#1A1A1A' }}>{c.lib}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'right', color: '#8C9BAB' }}>{fmt(c.debit)}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'right', color: '#8C9BAB' }}>{fmt(c.credit)}</td>
                    <td style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 500, color: c.solde >= 0 ? '#1A1A1A' : '#D85A30' }}>{fmt(Math.abs(c.solde))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Niveau 2 : écritures du compte */}
          {drill.niveau === 2 && drill.lignes && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Journal</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Libellé pièce</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Débit</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Crédit</th>
                </tr>
              </thead>
              <tbody>
                {drill.lignes.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                    <td style={{ padding: '6px 4px', color: '#8C9BAB' }}>{l.EcritureDate}</td>
                    <td style={{ padding: '6px 4px', color: '#8C9BAB' }}>{l.JournalCode}</td>
                    <td style={{ padding: '6px 4px', color: '#1A1A1A' }}>{l.EcritureLib || l.PieceRef || '—'}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: l.Debit > 0 ? '#1A1A1A' : '#F2F3F5' }}>{l.Debit > 0 ? fmt(l.Debit) : '—'}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: l.Credit > 0 ? '#1A1A1A' : '#F2F3F5' }}>{l.Credit > 0 ? fmt(l.Credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      </div>
    </>
  )
}
