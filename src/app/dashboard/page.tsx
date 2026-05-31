'use client'
import React from 'react'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
  solde: number
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
  tauxChargesPersonnel: number
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
  tresorerie: number
  dettesFinancieres: number
  dfn: number
  levier: number | null
  fraisGeneraux: number
  tauxFraisGeneraux: number
}

interface DrillData {
  niveau: 1 | 2
  titre: string
  racines?: string[]
  titrePere?: string
  comptes?: SoldeCompte[]
  lignes?: LigneFEC[]
  compteNum?: string
}

// ─── Parseur FEC ──────────────────────────────────────────────────────────────

function parseFEC(texte: string): LigneFEC[] {
  const lignes = texte.split(/\r?\n/).filter(l => l.trim())
  if (lignes.length < 2) return []

  const premiereLigne = lignes[0]
  const sep = premiereLigne.includes('|') ? '|' : premiereLigne.includes('\t') ? '\t' : ';'
  const headers = premiereLigne.split(sep).map(h => h.trim().replace(/^"(.+)"$/, '$1'))

  const idx = (nom: string) => {
    const i = headers.findIndex(h => h.toLowerCase() === nom.toLowerCase())
    return i >= 0 ? i : -1
  }

  const iJournalCode  = idx('JournalCode')
  const iEcritureDate = idx('EcritureDate')
  const iCompteNum    = idx('CompteNum')
  const iCompteLib    = idx('CompteLib')
  const iDebit        = idx('Debit')
  const iCredit       = idx('Credit')
  const iEcritureLib  = idx('EcritureLib')
  const iPieceRef     = idx('PieceRef')

  const result: LigneFEC[] = []
  const parseNum = (s: string) => s ? parseFloat(s.replace(',', '.').replace(/\s/g, '')) || 0 : 0

  for (let i = 1; i < lignes.length; i++) {
    const cols = lignes[i].split(sep).map(c => c.trim().replace(/^"(.+)"$/, '$1'))
    if (cols.length < 5) continue
    result.push({
      JournalCode:  iJournalCode  >= 0 ? cols[iJournalCode]  : '',
      EcritureDate: iEcritureDate >= 0 ? cols[iEcritureDate] : '',
      CompteNum:    iCompteNum    >= 0 ? cols[iCompteNum]    : '',
      CompteLib:    iCompteLib    >= 0 ? cols[iCompteLib]    : '',
      Debit:        parseNum(iDebit  >= 0 ? cols[iDebit]  : '0'),
      Credit:       parseNum(iCredit >= 0 ? cols[iCredit] : '0'),
      EcritureLib:  iEcritureLib  >= 0 ? cols[iEcritureLib]  : '',
      PieceRef:     iPieceRef     >= 0 ? cols[iPieceRef]     : '',
    })
  }
  return result
}

// ─── Détection exercice & filtrage par période ────────────────────────────────

function detecterExercice(lignes: LigneFEC[]): { debut: string; fin: string; annee: number } {
  const dates = lignes
    .map(l => l.EcritureDate)
    .filter(d => d && d.length >= 8)
    .map(d => d.replace(/\D/g, '').slice(0, 8))
    .sort()
  if (dates.length === 0) return { debut: '', fin: '', annee: new Date().getFullYear() }
  const debut = dates[0]
  const fin   = dates[dates.length - 1]
  const annee = parseInt(fin.slice(0, 4))
  return { debut, fin, annee }
}

function parseDate(d: string): number {
  // Formats : YYYYMMDD, YYYY-MM-DD, DD/MM/YYYY
  const s = d.replace(/\D/g, '')
  if (s.length === 8) {
    // Essai YYYYMMDD
    const y = parseInt(s.slice(0, 4))
    if (y > 1900 && y < 2100) return new Date(y, parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8))).getTime()
    // Sinon DDMMYYYY
    return new Date(parseInt(s.slice(4, 8)), parseInt(s.slice(2, 4)) - 1, parseInt(s.slice(0, 2))).getTime()
  }
  return new Date(d).getTime()
}

// Convertit une date FEC (YYYYMMDD ou DDMMYYYY) en YYYY-MM-DD pour comparaison
function toIso(d: string): string {
  const s = d.replace(/\D/g, '')
  if (s.length < 8) return ''
  const y = parseInt(s.slice(0, 4))
  if (y > 1900 && y < 2100) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
  // DDMMYYYY
  return `${s.slice(4,8)}-${s.slice(2,4)}-${s.slice(0,2)}`
}

function filtrerParPeriode(lignes: LigneFEC[], periode: 'exercice' | 'perso', dateDebut: string, dateFin: string): LigneFEC[] {
  if (periode === 'exercice') return lignes
  if (!dateDebut && !dateFin) return lignes
  return lignes.filter(l => {
    const iso = toIso(l.EcritureDate)
    if (!iso) return true
    if (dateDebut && iso < dateDebut) return false
    if (dateFin   && iso > dateFin)   return false
    return true
  })
}

function labelPeriode(periode: 'exercice' | 'perso', exercice: { annee: number }, dateDebut: string, dateFin: string): string {
  if (periode === 'exercice') return `Exercice ${exercice.annee}`
  if (dateDebut && dateFin) {
    const fmt = (s: string) => s.split('-').reverse().join('/')
    return `${fmt(dateDebut)} → ${fmt(dateFin)}`
  }
  if (dateDebut) return `Depuis le ${dateDebut.split('-').reverse().join('/')}`
  if (dateFin)   return `Jusqu au ${dateFin.split('-').reverse().join('/')}`
  return 'Periode personnalisee'
}

// ─── Calcul PCG ───────────────────────────────────────────────────────────────

function soldesParRacine(lignes: LigneFEC[], racines: string[]): number {
  let total = 0
  for (const l of lignes) {
    for (const r of racines) {
      if (l.CompteNum.startsWith(r)) { total += l.Debit - l.Credit; break }
    }
  }
  return total
}

// Normalise un numéro de compte à exactement 8 caractères
// Trop court → complète avec des 0 à droite  (706 → 70600000)
// Trop long  → tronque à 8 caractères        (7060000000009 → 70600000)
function normaliserCompte(num: string): string {
  const n = num.replace(/\s/g, '')
  if (n.length >= 8) return n.slice(0, 8)
  return n.padEnd(8, '0')
}

function getSoldesComptes(lignes: LigneFEC[], racines: string[]): SoldeCompte[] {
  const map = new Map<string, SoldeCompte>()
  for (const l of lignes) {
    for (const r of racines) {
      if (l.CompteNum.startsWith(r)) {
        const num8 = normaliserCompte(l.CompteNum)
        const ex = map.get(num8)
        if (ex) {
          ex.debit  += l.Debit
          ex.credit += l.Credit
          ex.solde   = ex.debit - ex.credit
        } else {
          map.set(num8, { num: num8, lib: l.CompteLib || l.CompteNum, debit: l.Debit, credit: l.Credit, solde: l.Debit - l.Credit })
        }
        break
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.num.localeCompare(b.num))
}

function calculerIndicateurs(lignes: LigneFEC[]): IndicateursFinanciers {
  const ventes701 = -soldesParRacine(lignes, ['701','702','703','704','705','706','707','708'])
  const prod71    = -soldesParRacine(lignes, ['71'])
  const prod72    = -soldesParRacine(lignes, ['72'])
  const subv74    = -soldesParRacine(lignes, ['74'])
  const autres75  = -soldesParRacine(lignes, ['75'])
  const achats60  = soldesParRacine(lignes, ['601','602','603','604','605','606','607','608','609'])
  const var60     = soldesParRacine(lignes, ['6031','6032','6037'])
  const ext61     = soldesParRacine(lignes, ['61'])
  const ext62     = soldesParRacine(lignes, ['62'])
  const imp63     = soldesParRacine(lignes, ['63'])
  const pers64    = soldesParRacine(lignes, ['64'])
  const dot68     = soldesParRacine(lignes, ['681','686','687'])
  const finChg66  = soldesParRacine(lignes, ['66'])
  const finProd76 = -soldesParRacine(lignes, ['76'])
  const excChg67  = soldesParRacine(lignes, ['67'])
  const excProd77 = -soldesParRacine(lignes, ['77'])
  const is695     = soldesParRacine(lignes, ['695','696','697','698','699'])

  // Trésorerie : solde net 512x (banques) + 530x (caisse)
  // Crédit = positif pour les comptes d'actif → on prend solde débiteur
  const treso512  = soldesParRacine(lignes, ['512'])
  const treso530  = soldesParRacine(lignes, ['530'])
  const tresorerie = treso512 + treso530

  // Dettes financières : 164x (emprunts LT) + 163x (découverts)
  // Comptes de passif → solde créditeur = positif → on inverse
  const dettes164 = -soldesParRacine(lignes, ['164'])
  const dettes163 = -soldesParRacine(lignes, ['163'])
  const dettesFinancieres = dettes164 + dettes163

  const ca              = ventes701
  const achatsMatieres  = achats60 + var60
  const chargesExternes = ext61 + ext62
  const margebrute      = ca + prod71 + prod72 - achatsMatieres - chargesExternes
  const tauxMargebrute  = ca > 0 ? (margebrute / ca) * 100 : 0
  const valeurAjoutee   = margebrute + subv74 + autres75 - imp63
  const ebe             = valeurAjoutee - pers64
  const tauxEbe         = ca > 0 ? (ebe / ca) * 100 : 0
  const rex             = ebe - dot68
  const resultatFinancier    = finProd76 - finChg66
  const resultatExceptionnel = excProd77 - excChg67
  const resultatNet          = rex + resultatFinancier + resultatExceptionnel - is695
  const tauxResultatNet      = ca > 0 ? (resultatNet / ca) * 100 : 0
  const caf                  = resultatNet + dot68

  // DFN = Dettes financières - Trésorerie
  const dfn    = dettesFinancieres - tresorerie
  // Levier = DFN / EBITDA (significatif seulement si EBITDA > 0)
  const levier = ebe > 0 ? dfn / ebe : null

  // Frais généraux = charges externes 61x + 62x + impôts/taxes 63x
  const fraisGeneraux     = chargesExternes + imp63
  const tauxFraisGeneraux = ca > 0 ? (fraisGeneraux / ca) * 100 : 0
  const tauxChargesPersonnel = ca > 0 ? (pers64 / ca) * 100 : 0

  return {
    ca, achatsMatieres, margeCommerciale: ca - achatsMatieres,
    productionVendue: ventes701, productionImmobilisee: prod72,
    margebrute, tauxMargebrute, chargesExternes,
    valeurAjoutee, subventionsExploitation: subv74,
    chargesPersonnel: pers64, tauxChargesPersonnel, impotsTaxes: imp63,
    ebe, tauxEbe, dotationsAmort: dot68, rex,
    resultatFinancier, resultatExceptionnel, impotsSocietes: is695,
    resultatNet, tauxResultatNet, caf,
    tresorerie, dettesFinancieres, dfn, levier,
    fraisGeneraux, tauxFraisGeneraux,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtPct  = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

// ─── Composant principal ──────────────────────────────────────────────────────

interface ExerciceData {
  annee: number
  nomFichier: string
  lignes: LigneFEC[]
}

interface ConfirmationImport {
  file: File
  parsed: LigneFEC[]
  anneeDetectee: number
  anneeExistante: number
}

export default function DashboardPage() {
  const [exercices, setExercices]       = useState<Record<number, ExerciceData>>({})
  const [anneeActive, setAnneeActive]   = useState<number>(new Date().getFullYear())
  const [isDragging, setIsDragging]     = useState(false)
  const [erreur, setErreur]             = useState('')
  const [drill, setDrill]               = useState<DrillData | null>(null)
  const [periodeTab, setPeriodeTab]     = useState<'exercice' | 'perso'>('exercice')
  const [dateDebut, setDateDebut]       = useState('')
  const [dateFin, setDateFin]           = useState('')
  const [chargement, setChargement]     = useState(true)
  const [sauvegarde, setSauvegarde]     = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [confirmation, setConfirmation] = useState<ConfirmationImport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Charger tous les exercices depuis Supabase
  useEffect(() => {
    const charger = async () => {
      setChargement(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setChargement(false); return }

        const { data, error } = await supabase
          .from('fec_exercices')
          .select('annee, nom_fichier, ecritures')
          .eq('user_id', user.id)
          .order('annee', { ascending: false })

        if (!error && data && data.length > 0) {
          const map: Record<number, ExerciceData> = {}
          for (const row of data) {
            map[row.annee] = { annee: row.annee, nomFichier: row.nom_fichier ?? '', lignes: row.ecritures as LigneFEC[] }
          }
          setExercices(map)
          setAnneeActive(Math.max(...data.map(r => r.annee)))
        }
      } catch (e) {
        console.error('Erreur chargement:', e)
      } finally {
        setChargement(false)
      }
    }
    charger()
  }, [])

  const sauvegarderExercice = async (lignes: LigneFEC[], nom: string, annee: number) => {
    setSauvegarde('saving')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSauvegarde('error'); return }
      const { error } = await supabase
        .from('fec_exercices')
        .upsert({ user_id: user.id, annee, nom_fichier: nom, ecritures: lignes, updated_at: new Date().toISOString() }, { onConflict: 'user_id,annee' })
      setSauvegarde(error ? 'error' : 'saved')
      setTimeout(() => setSauvegarde('idle'), 3000)
    } catch { setSauvegarde('error') }
  }

  const importerExercice = (lignes: LigneFEC[], nom: string, annee: number) => {
    setExercices(prev => ({ ...prev, [annee]: { annee, nomFichier: nom, lignes } }))
    setAnneeActive(annee)
    sauvegarderExercice(lignes, nom, annee)
    setConfirmation(null)
  }

  const traiterFichier = useCallback((file: File) => {
    setErreur('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const texte = e.target?.result as string
      const parsed = parseFEC(texte)
      if (parsed.length === 0) {
        setErreur('Fichier non reconnu. Verifiez qu il s agit bien d un FEC.')
        return
      }
      const anneeDetectee = detecterExercice(parsed).annee
      // Vérifie si cet exercice existe déjà
      if (exercices[anneeDetectee]) {
        setConfirmation({ file, parsed, anneeDetectee, anneeExistante: anneeDetectee })
        return
      }
      // Vérifie la limite de 3 exercices
      const anneesExistantes = Object.keys(exercices).map(Number).sort((a,b) => b-a)
      if (anneesExistantes.length >= 3 && !exercices[anneeDetectee]) {
        setErreur(`Limite de 3 exercices atteinte (${anneesExistantes.join(', ')}). Supprimez un exercice avant d en importer un nouveau.`)
        return
      }
      importerExercice(parsed, file.name, anneeDetectee)
    }
    reader.readAsText(file, 'UTF-8')
  }, [exercices])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) traiterFichier(file)
  }, [traiterFichier])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) traiterFichier(file)
    if (e.target) e.target.value = ''
  }

  const supprimerExercice = async (annee: number) => {
    setExercices(prev => { const n = {...prev}; delete n[annee]; return n })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('fec_exercices').delete().eq('user_id', user.id).eq('annee', annee)
    } catch {}
  }

  // Données N et N-1
  const exN   = exercices[anneeActive]
  const exN1  = exercices[anneeActive - 1]

  // En mode dates perso, merger toutes les lignes des exercices couverts par la plage
  const lignesAllN: LigneFEC[] | null = (() => {
    if (periodeTab === 'perso' && dateDebut && dateFin) {
      const anneesTriees = Object.keys(exercices).map(Number).sort((a, b) => a - b)
      const merged: LigneFEC[] = []
      for (const a of anneesTriees) {
        const ex = exercices[a]
        if (!ex) continue
        const exInfo = detecterExercice(ex.lignes)
        // Inclure si l'exercice chevauche la plage sélectionnée
        if (toIso(exInfo.fin) >= dateDebut && toIso(exInfo.debut) <= dateFin) {
          merged.push(...ex.lignes)
        }
      }
      return merged.length > 0 ? merged : (exN?.lignes ?? null)
    }
    return exN?.lignes ?? null
  })()

  const exercice   = lignesAllN ? detecterExercice(lignesAllN) : { debut: '', fin: '', annee: anneeActive }
  const lignes     = lignesAllN ? filtrerParPeriode(lignesAllN, periodeTab, dateDebut, dateFin) : null
  const indicateurs  = lignes          ? calculerIndicateurs(lignes) : null
  const indicateursN1 = exN1?.lignes   ? calculerIndicateurs(exN1.lignes) : null
  const nbLignes   = lignesAllN?.length ?? 0
  const labelPer   = labelPeriode(periodeTab, exercice, dateDebut, dateFin)
  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)

  const openDrill1 = (titre: string, racines: string[]) => {
    if (!lignes) return
    setDrill({ niveau: 1, titre, racines, comptes: getSoldesComptes(lignes, racines) })
  }

  const openDrill2 = (compteNum: string, compteLib: string) => {
    if (!lignes || !drill) return
    // compteNum est normalisé à 8 chars — on filtre sur les lignes dont le numéro normalisé correspond
    setDrill(prev => ({
      niveau: 2, titre: `${compteNum} — ${compteLib}`, compteNum,
      lignes: lignes.filter(l => normaliserCompte(l.CompteNum) === compteNum),
      racines: prev?.racines, titrePere: prev?.titre, comptes: prev?.comptes,
    }))
  }

  const retourNiveau1 = () => {
    if (!drill) return
    setDrill({ niveau: 1, titre: drill.titrePere ?? drill.titre, racines: drill.racines, comptes: drill.comptes })
  }

  // Écran de chargement
  if (chargement) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 13, color: '#8C9BAB' }}>Chargement de vos donnees...</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // Zone d'import commune (affichée si aucun exercice N chargé)
  const ZoneImport = () => (
    <div style={{ maxWidth: 600, width: '100%' }}>
      {/* Exercices chargés */}
      {anneesDisponibles.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>Exercices charges</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {anneesDisponibles.map(annee => (
              <div key={annee} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 10, padding: '10px 16px', border: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(184,169,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>Exercice {annee}</div>
                  <div style={{ fontSize: 11, color: '#8C9BAB' }}>{exercices[annee].nomFichier} · {exercices[annee].lignes.length.toLocaleString('fr-FR')} lignes</div>
                </div>
                <button onClick={() => setAnneeActive(annee)} style={{ background: annee === anneeActive ? '#1A1A1A' : '#F2F3F5', color: annee === anneeActive ? '#fff' : '#1A1A1A', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                  {annee === anneeActive ? 'Actif' : 'Voir'}
                </button>
                <button onClick={() => supprimerExercice(annee)} style={{ background: 'transparent', border: '0.5px solid rgba(216,90,48,0.3)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#D85A30', cursor: 'pointer' }}>
                  Suppr.
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone de drop */}
      {anneesDisponibles.length < 3 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${isDragging ? '#B8A98A' : 'rgba(184,169,138,0.4)'}`, borderRadius: 16, padding: '36px 40px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(184,169,138,0.05)' : '#fff', transition: 'all 0.2s' }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(184,169,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', marginBottom: 6 }}>
            {anneesDisponibles.length === 0 ? 'Importez votre premier FEC' : `Ajouter un exercice (${3 - anneesDisponibles.length} restant)`}
          </div>
          <div style={{ fontSize: 12, color: '#8C9BAB', marginBottom: 16 }}>Glissez votre fichier ou cliquez pour parcourir</div>
          <div style={{ display: 'inline-block', background: '#1A1A1A', color: '#F2F3F5', fontSize: 12, fontWeight: 500, padding: '9px 22px', borderRadius: 8 }}>Choisir un FEC</div>
          <input ref={fileRef} type="file" accept=".txt,.csv,.tsv" style={{ display: 'none' }} onChange={onFileChange} />
        </div>
      )}

      {erreur && (
        <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(216,90,48,0.08)', borderRadius: 8, fontSize: 13, color: '#993C1D', border: '0.5px solid rgba(216,90,48,0.2)' }}>
          {erreur}
        </div>
      )}
    </div>
  )

  // Modal de confirmation d'écrasement
  const ModalConfirmation = () => {
    if (!confirmation) return null
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 14, padding: '28px 32px', width: 440, zIndex: 70, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', marginBottom: 12 }}>Remplacer l exercice {confirmation.anneeDetectee} ?</div>
          <div style={{ fontSize: 13, color: '#8C9BAB', lineHeight: 1.6, marginBottom: 24 }}>
            Un FEC pour l exercice <strong style={{ color: '#1A1A1A' }}>{confirmation.anneeDetectee}</strong> est deja charge ({exercices[confirmation.anneeDetectee]?.nomFichier}).
            L importer ecrasera les donnees existantes pour cet exercice.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmation(null)} style={{ background: '#F2F3F5', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, color: '#1A1A1A', cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={() => importerExercice(confirmation.parsed, confirmation.file.name, confirmation.anneeDetectee)} style={{ background: '#1A1A1A', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, color: '#fff', fontWeight: 500, cursor: 'pointer' }}>
              Confirmer le remplacement
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Rendu : pas encore de N actif ──────────────────────────────────────────
  if (!indicateurs || !lignes) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Topbar titre="KPIs & SIG" periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} hasData={false} labelPer="" dateDebut={dateDebut} dateFin={dateFin} setDateDebut={setDateDebut} setDateFin={setDateFin} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
            <ZoneImport />
          </div>
        </div>
        <ModalConfirmation />
      </div>
    )
  }

  const ind  = indicateurs
  const indN1 = indicateursN1

  // Delta N/N-1 : retourne { valeur, pct, couleur }
  const delta = (vN: number, vN1: number | undefined) => {
    if (vN1 === undefined || vN1 === 0) return null
    const diff = vN - vN1
    const pct  = (diff / Math.abs(vN1)) * 100
    return { diff, pct, couleur: diff >= 0 ? '#1D9E75' : '#D85A30' }
  }

  // ── Rendu : dashboard avec données ────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          titre="KPIs & SIG"
          periodeTab={periodeTab}
          setPeriodeTab={setPeriodeTab}
          hasData={true}
          labelPer={labelPer}
          nomFichier={exN?.nomFichier}
          nbLignes={nbLignes}
          dateDebut={dateDebut}
          dateFin={dateFin}
          setDateDebut={setDateDebut}
          setDateFin={setDateFin}
          sauvegarde={sauvegarde}
          anneeActive={anneeActive}
          anneesDisponibles={anneesDisponibles}
          setAnneeActive={setAnneeActive}
        />
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>

          {/* ── Ligne 1 : Performance ── */}
          <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Performance</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard label="Chiffre d affaires" value={fmt(ind.ca)} delta={delta(ind.ca, indN1?.ca)} sub={`Exercice ${exercice.annee}`} accent="#B8A98A" onClick={() => openDrill1('Chiffre d affaires', ['70','71','72'])} />
            <KpiCard label="Marge brute" value={fmt(ind.margebrute)} delta={delta(ind.margebrute, indN1?.margebrute)} sub={`Taux : ${fmtPct(ind.tauxMargebrute)} du CA`} subBold accent="#B8A98A" onClick={() => openDrill1('Marge brute', ['70','71','72','601','602','603','604','605','606','607','608','609','61','62'])} />
            <KpiCard label="EBITDA" value={fmt(ind.ebe)} delta={delta(ind.ebe, indN1?.ebe)} sub={`Taux : ${fmtPct(ind.tauxEbe)} du CA`} subBold accent={ind.tauxEbe >= 10 ? '#1D9E75' : '#D85A30'} onClick={() => openDrill1('EBITDA', ['70','71','72','601','602','603','604','605','606','607','608','609','61','62','63','64'])} />
            <KpiCard label="Resultat net" value={fmt(ind.resultatNet)} delta={delta(ind.resultatNet, indN1?.resultatNet)} sub={`Taux : ${fmtPct(ind.tauxResultatNet)} du CA`} subBold accent={ind.resultatNet >= 0 ? '#B8A98A' : '#D85A30'} onClick={() => openDrill1('Resultat net', ['60','61','62','63','64','65','66','67','68','69','70','71','72','74','75','76','77'])} />
          </div>

          {/* ── Ligne 2 : Structure financière ── */}
          <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Structure financiere</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard label="Tresorerie" value={fmt(ind.tresorerie)} delta={delta(ind.tresorerie, indN1?.tresorerie)} sub="Comptes 512x + 530x" accent={ind.tresorerie >= 0 ? '#1D9E75' : '#D85A30'} onClick={() => openDrill1('Tresorerie', ['512','530'])} />
            <KpiCard label="Dettes financieres" value={fmt(ind.dettesFinancieres)} delta={delta(ind.dettesFinancieres, indN1?.dettesFinancieres)} sub="Emprunts 164x + decouvert 163x" accent="#8C9BAB" onClick={() => openDrill1('Dettes financieres', ['163','164'])} />
            <KpiCard label="DFN (Dettes Fin. Nettes)" value={fmt(ind.dfn)} delta={delta(ind.dfn, indN1?.dfn)} sub="Dettes - Tresorerie" accent={ind.dfn <= 0 ? '#1D9E75' : ind.dfn > ind.ebe * 3 ? '#D85A30' : '#B8A98A'} onClick={() => openDrill1('DFN — Dettes et Tresorerie', ['163','164','512','530'])} />
            <KpiCard label="Levier EBITDA / DFN" value={ind.levier !== null ? `${(Math.round(ind.levier * 10) / 10).toFixed(1)}x` : '—'} sub={ind.levier !== null ? (ind.levier <= 3 ? 'Levier maitrise' : 'Levier eleve > 3x') : 'EBITDA negatif'} accent={ind.levier === null ? '#8C9BAB' : ind.levier <= 3 ? '#1D9E75' : '#D85A30'} />
          </div>

          {/* ── Ligne 3 : Charges ── */}
          <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Charges</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard label="Charges de personnel" value={fmt(ind.chargesPersonnel)} delta={delta(ind.chargesPersonnel, indN1?.chargesPersonnel)} sub={`Taux : ${fmtPct(ind.tauxChargesPersonnel)} du CA`} subBold accent={ind.tauxChargesPersonnel > 50 ? '#D85A30' : '#B8A98A'} onClick={() => openDrill1('Charges de personnel', ['64'])} />
            <KpiCard label="Frais generaux" value={fmt(ind.fraisGeneraux)} delta={delta(ind.fraisGeneraux, indN1?.fraisGeneraux)} sub={`Taux : ${fmtPct(ind.tauxFraisGeneraux)} du CA`} subBold accent="#8C9BAB" onClick={() => openDrill1('Frais generaux', ['61','62','63'])} />
            <div /><div />
          </div>

          {/* SIG + Ratios */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

            {/* SIG */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '14px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>Soldes intermediaires de gestion</div>
                <div style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic' }}>Période personnalisée</div>
              </div>
              <div style={{ padding: '6px 18px 2px' }}>
                <div style={{ fontSize: 10, color: '#B8A98A', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Cliquer pour voir le detail des comptes
                </div>
              </div>
              <div style={{ padding: '0 18px 16px' }}>
                <SigLigne nom="Production vendue" codes="70x·71x·72x" valeur={ind.productionVendue} pct={ind.ca > 0 ? (ind.productionVendue/ind.ca)*100 : 0} bold onClick={() => openDrill1('Production vendue', ['70','71','72'])} />
                {ind.achatsMatieres > 0 && <SigLigne nom="Achats & variation de stocks" codes="60x" valeur={-ind.achatsMatieres} pct={ind.ca > 0 ? (-ind.achatsMatieres/ind.ca)*100 : 0} onClick={() => openDrill1('Achats & variation de stocks', ['601','602','603','604','605','606','607','608','609'])} />}
                <SigLigne nom="Charges externes" codes="61x·62x" valeur={-ind.chargesExternes} pct={ind.ca > 0 ? (-ind.chargesExternes/ind.ca)*100 : 0} onClick={() => openDrill1('Charges externes', ['61','62'])} />
                <SigTotal nom="Marge brute" valeur={ind.margebrute} pct={ind.tauxMargebrute} />
                <div style={{ height: 1, background: '#F2F3F5', margin: '8px 0' }} />
                <SigLigne nom="Impots & taxes" codes="63x" valeur={-ind.impotsTaxes} pct={ind.ca > 0 ? (-ind.impotsTaxes/ind.ca)*100 : 0} onClick={() => openDrill1('Impots et taxes', ['63'])} />
                <SigLigne nom="Charges de personnel" codes="64x" valeur={-ind.chargesPersonnel} pct={ind.ca > 0 ? (-ind.chargesPersonnel/ind.ca)*100 : 0} alert={ind.ca > 0 && (ind.chargesPersonnel/ind.ca) > 0.5} onClick={() => openDrill1('Charges de personnel', ['64'])} />
                <SigTotal nom="EBE (Excedent Brut d Exploitation)" valeur={ind.ebe} pct={ind.tauxEbe} />
                <div style={{ height: 1, background: '#F2F3F5', margin: '8px 0' }} />
                <SigLigne nom="Dotations aux amortissements" codes="68x" valeur={-ind.dotationsAmort} pct={ind.ca > 0 ? (-ind.dotationsAmort/ind.ca)*100 : 0} onClick={() => openDrill1('Dotations amortissements', ['681','686','687'])} />
                <SigLigne nom="Resultat financier" codes="66x·76x" valeur={ind.resultatFinancier} pct={ind.ca > 0 ? (ind.resultatFinancier/ind.ca)*100 : 0} onClick={() => openDrill1('Resultat financier', ['66','76'])} />
                <SigLigne nom="Resultat exceptionnel" codes="67x·77x" valeur={ind.resultatExceptionnel} pct={ind.ca > 0 ? (ind.resultatExceptionnel/ind.ca)*100 : 0} onClick={() => openDrill1('Resultat exceptionnel', ['67','77'])} />
                <SigLigne nom="Impots sur les benefices" codes="695x" valeur={-ind.impotsSocietes} pct={ind.ca > 0 ? (-ind.impotsSocietes/ind.ca)*100 : 0} onClick={() => openDrill1('Impots sur les benefices', ['695','696','697','698','699'])} />
                <SigTotal nom="Resultat net" valeur={ind.resultatNet} pct={ind.tauxResultatNet} large />
              </div>
            </div>

            {/* Ratios + Analyse */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 14 }}>Ratios cles</div>
                {[
                  { label: 'Taux de marge brute',     value: ind.tauxMargebrute,                                    ref: 'secteur ~55-70 %',    max: 100, warn: ind.tauxMargebrute < 30 },
                  { label: "Taux d EBE / CA",          value: ind.tauxEbe,                                           ref: 'objectif > 10 %',     max: 30,  warn: ind.tauxEbe < 10 },
                  { label: 'Charges personnel / CA',   value: ind.ca > 0 ? (ind.chargesPersonnel/ind.ca)*100 : 0,   ref: 'seuil alerte 50 %',   max: 80,  warn: ind.ca > 0 && (ind.chargesPersonnel/ind.ca) > 0.5 },
                  { label: 'Taux de resultat net',     value: ind.tauxResultatNet,                                   ref: 'objectif > 5 %',      max: 20,  warn: ind.tauxResultatNet < 5 },
                  { label: 'CAF / CA',                 value: ind.ca > 0 ? (ind.caf/ind.ca)*100 : 0,                ref: 'resultat net + amort.', max: 20 },
                ].map((r, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#8C9BAB' }}>{r.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: r.warn ? '#D85A30' : '#1A1A1A' }}>{fmtPct(r.value)}</span>
                        <span style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic' }}>{r.ref}</span>
                      </div>
                    </div>
                    <div style={{ height: 3, background: '#F2F3F5', borderRadius: 2 }}>
                      <div style={{ height: 3, borderRadius: 2, width: `${Math.min(Math.abs(r.value)/r.max*100,100)}%`, background: r.warn ? '#D85A30' : '#B8A98A', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px', flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>Analyse Alvio</div>
                <AnalyseAuto ind={ind} />
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>Masse salariale</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A' }}>{fmt(ind.chargesPersonnel)}</div>
              <div style={{ fontSize: 11, color: '#8C9BAB', fontStyle: 'italic', marginTop: 2 }}>
                dont <strong style={{ color: ind.ca > 0 && (ind.chargesPersonnel/ind.ca) > 0.5 ? '#D85A30' : '#1A1A1A', fontStyle: 'normal' }}>{fmtPct(ind.ca > 0 ? (ind.chargesPersonnel/ind.ca)*100 : 0)} du CA</strong>
              </div>
              <div style={{ marginTop: 12 }}>
                {[['Charges externes', fmt(ind.chargesExternes)],['CAF', fmt(ind.caf)],["Resultat d exploitation", fmt(ind.rex)]].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: 11, color: '#8C9BAB' }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>Point mort</div>
              {(() => {
                const chargesFixes = ind.chargesPersonnel + ind.chargesExternes + ind.impotsTaxes
                const tauxMarge    = ind.ca > 0 ? ind.margebrute / ind.ca : 0
                const pointMort    = tauxMarge > 0 ? chargesFixes / tauxMarge : 0
                const margeSec     = ind.ca - pointMort
                const couverture   = pointMort > 0 ? (ind.ca / pointMort) * 100 : 0
                return (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A' }}>{fmt(pointMort)}</div>
                    <div style={{ fontSize: 11, color: '#8C9BAB', fontStyle: 'italic', marginTop: 2 }}>CA seuil de rentabilite</div>
                    <div style={{ marginTop: 12 }}>
                      {[['CA realise', fmt(ind.ca)],['Marge de securite', fmt(margeSec)],['Couverture', `${Math.round(couverture)} %`]].map(([k,v]) => (
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
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', marginBottom: 12 }}>Fichiers FEC</div>
              {/* Exercices chargés */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: anneesDisponibles.length < 3 ? 12 : 0 }}>
                {[anneeActive, anneeActive - 1, anneeActive - 2].map(annee => {
                  const ex = exercices[annee]
                  return (
                    <div key={annee} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, background: ex ? (annee === anneeActive ? 'rgba(184,169,138,0.08)' : '#F7F8FA') : 'transparent', border: `0.5px solid ${ex ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: ex ? '#1D9E75' : '#E5E7EB', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: ex ? '#1A1A1A' : '#8C9BAB' }}>Exercice {annee}</div>
                        {ex && <div style={{ fontSize: 10, color: '#8C9BAB' }}>{ex.nomFichier} · {ex.lignes.length.toLocaleString('fr-FR')} lignes</div>}
                        {!ex && <div style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic' }}>Non charge</div>}
                      </div>
                      {ex && annee !== anneeActive && (
                        <button onClick={() => setAnneeActive(annee)} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 5, padding: '3px 8px', fontSize: 10, color: '#1A1A1A', cursor: 'pointer' }}>Voir</button>
                      )}
                      {ex && (
                        <button onClick={() => supprimerExercice(annee)} style={{ background: 'transparent', border: 'none', padding: '3px 6px', fontSize: 10, color: '#D85A30', cursor: 'pointer' }}>✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Zone d'import compacte */}
              {anneesDisponibles.length < 3 && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{ border: `1.5px dashed ${isDragging ? '#B8A98A' : 'rgba(184,169,138,0.35)'}`, borderRadius: 8, padding: '10px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(184,169,138,0.04)' : 'transparent', transition: 'all 0.15s' }}
                >
                  <div style={{ fontSize: 11, color: '#8C9BAB' }}>+ Importer un FEC</div>
                  <input ref={fileRef} type="file" accept=".txt,.csv,.tsv" style={{ display: 'none' }} onChange={onFileChange} />
                </div>
              )}
              {erreur && <div style={{ marginTop: 8, fontSize: 11, color: '#993C1D' }}>{erreur}</div>}
            </div>
          </div>

        </div>
      </div>

      {drill && <DrillPanel drill={drill} onClose={() => setDrill(null)} onDrill2={openDrill2} onBack={retourNiveau1} />}
      <ModalConfirmation />
    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Sidebar() {
  const [userEmail, setUserEmail]     = useState('')
  const [initiales, setInitiales]     = useState('--')
  const [profilOpen, setProfilOpen]   = useState(false)
  const [userData, setUserData]       = useState<{ prenom: string; nom: string; siren: string; entreprise: Record<string, unknown> | null }>({ prenom: '', nom: '', siren: '', entreprise: null })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const email = user.email ?? ''
      setUserEmail(email)
      const meta = user.user_metadata ?? {}
      const prenom = meta.prenom ?? ''
      const nom    = meta.nom ?? ''
      const full   = meta.full_name ?? `${prenom} ${nom}`.trim() ?? meta.name ?? ''
      setUserData({
        prenom: prenom || full.split(' ')[0] || '',
        nom:    nom    || full.split(' ').slice(1).join(' ') || '',
        siren:  meta.siren ?? '',
        entreprise: meta.entreprise ?? null,
      })
      if (full) {
        const parts = full.trim().split(' ')
        setInitiales(parts.map((p: string) => p[0]).join('').slice(0, 2).toUpperCase())
      } else {
        setInitiales(email.slice(0, 2).toUpperCase())
      }
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const items = [
    { d: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', label: 'KPIs & SIG',    active: true,  href: '/dashboard' },
    { d: 'M3 3v18h18M7 16l4-4 4 4 5-5',                          label: 'Tresorerie',   active: false, href: '/dashboard' },
    { d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',   label: 'Previsionnel', active: false, href: '/dashboard' },
    { d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',                      label: 'Simulations',  active: false, href: '/dashboard' },
    { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12', label: 'Export', active: false, href: '/dashboard' },
  ]

  const [nomEntreprise, setNomEntreprise] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const meta = user.user_metadata ?? {}
      setNomEntreprise(meta.entreprise?.nom ?? '')
    })
  }, [])

  return (
    <>
<Sidebar activePage="dashboard"/>

      {/* Modale profil */}
      {profilOpen && (
        <ProfilModal
          initial={userData}
          onClose={() => setProfilOpen(false)}
          onSaved={(updated) => {
            setUserData(updated)
            const full = `${updated.prenom} ${updated.nom}`.trim()
            if (full) setInitiales(full.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase())
            setProfilOpen(false)
          }}
        />
      )}
    </>
  )
}

function ProfilModal({ initial, onClose, onSaved }: {
  initial: { prenom: string; nom: string; siren: string; entreprise: Record<string, unknown> | null }
  onClose: () => void
  onSaved: (updated: { prenom: string; nom: string; siren: string; entreprise: Record<string, unknown> | null }) => void
}) {
  const [prenom, setPrenom]       = useState(initial.prenom)
  const [nom, setNom]             = useState(initial.nom)
  const [siren, setSiren]         = useState(initial.siren)
  const [entreprise, setEntreprise] = useState<Record<string, unknown> | null>(initial.entreprise)
  const [sirenLoading, setSirenLoading] = useState(false)
  const [sirenError, setSirenError]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [erreur, setErreur]       = useState('')

  const handleSirenChange = async (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 9)
    setSiren(clean)
    setSirenError('')
    setEntreprise(null)
    if (clean.length !== 9) return
    setSirenLoading(true)
    try {
      const res = await fetch(`/api/siren?siren=${clean}`)
      const data = await res.json()
      if (!res.ok) setSirenError(data.error || 'Entreprise non trouvee')
      else setEntreprise(data)
    } catch { setSirenError('Erreur reseau') }
    finally { setSirenLoading(false) }
  }

  const handleSave = async () => {
    if (!prenom.trim() || !nom.trim()) { setErreur('Prenom et nom requis'); return }
    setSaving(true); setErreur('')
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          prenom, nom,
          full_name: `${prenom} ${nom}`.trim(),
          siren: siren || null,
          entreprise: entreprise ?? null,
        }
      })
      if (error) throw error
      setSaved(true)
      setTimeout(() => onSaved({ prenom, nom, siren, entreprise }), 800)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur de sauvegarde')
    } finally { setSaving(false) }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
    padding: '9px 12px', fontSize: 13, color: '#1A1A1A',
    fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none',
    background: '#fff', boxSizing: 'border-box',
  }

  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#5C6670',
    letterSpacing: '.04em', textTransform: 'uppercase',
    marginBottom: 5, display: 'block',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: '#fff', borderRadius: 16, width: 460, maxHeight: '90vh', overflowY: 'auto',
        zIndex: 70, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: '28px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A' }}>Mon profil</div>
            <div style={{ fontSize: 12, color: '#8C9BAB', marginTop: 2 }}>Informations personnelles et entreprise</div>
          </div>
          <button onClick={onClose} style={{ background: '#F2F3F5', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="#8C9BAB" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Prenom + Nom */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Prenom</label>
              <input style={inputSt} type="text" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Jean" />
            </div>
            <div>
              <label style={lbl}>Nom</label>
              <input style={inputSt} type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Dupont" />
            </div>
          </div>

          {/* SIREN */}
          <div>
            <label style={lbl}>
              SIREN
              <span style={{ fontSize: 10, fontWeight: 400, color: '#8C9BAB', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>optionnel</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputSt, paddingRight: 36 }}
                type="text" placeholder="9 chiffres"
                value={siren}
                onChange={e => handleSirenChange(e.target.value)}
                maxLength={9}
              />
              {sirenLoading && (
                <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin .7s linear infinite' }}><circle cx="7" cy="7" r="5" stroke="rgba(184,169,138,.3)" strokeWidth="1.5"/><path d="M7 2a5 5 0 015 5" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
              )}
              {entreprise && !sirenLoading && (
                <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="#2a9d5c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </div>
            {sirenError && <span style={{ fontSize: 11, color: '#e25c5c', marginTop: 4, display: 'block' }}>{sirenError}</span>}

            {/* Apercu entreprise */}
            {(entreprise || (initial.entreprise && siren === initial.siren)) && !sirenLoading && (() => {
              const e = entreprise ?? initial.entreprise as Record<string, unknown>
              if (!e) return null
              return (
                <div style={{ marginTop: 10, padding: '12px 14px', background: 'rgba(184,169,138,0.08)', borderRadius: 10, border: '0.5px solid rgba(184,169,138,0.3)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>{e.nom as string}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                    {([
                      ['Forme', e.forme_juridique],
                      ['Creation', e.date_creation],
                      ['NAF', e.code_naf],
                      ['Activite', e.libelle_naf],
                      ['Siege', e.adresse],
                    ] as [string, unknown][]).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} style={{ gridColumn: k === 'Siege' || k === 'Activite' ? '1 / -1' : undefined }}>
                        <span style={{ fontSize: 10, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k} </span>
                        <span style={{ fontSize: 11, color: '#1A1A1A' }}>{v as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {erreur && <div style={{ fontSize: 12, color: '#e25c5c', padding: '8px 12px', background: 'rgba(226,92,92,0.08)', borderRadius: 8 }}>{erreur}</div>}

          {/* Bouton save */}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            style={{ background: saved ? '#1D9E75' : '#1A1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}
          >
            {saving
              ? <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin .7s linear infinite' }}><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,.3)" strokeWidth="2"/><path d="M9 2a7 7 0 017 7" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
              : saved
              ? <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Enregistre</>
              : 'Enregistrer les modifications'
            }
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

function Topbar({ titre, periodeTab, setPeriodeTab, hasData, labelPer, nomFichier, nbLignes, dateDebut, dateFin, setDateDebut, setDateFin, sauvegarde, anneeActive, anneesDisponibles, setAnneeActive }: {
  titre: string
  periodeTab: 'exercice' | 'perso'
  setPeriodeTab: (v: 'exercice' | 'perso') => void
  hasData: boolean
  labelPer: string
  nomFichier?: string
  nbLignes?: number
  onReset?: () => void
  dateDebut: string
  dateFin: string
  setDateDebut: (v: string) => void
  setDateFin: (v: string) => void
  sauvegarde?: 'idle' | 'saving' | 'saved' | 'error'
  anneeActive?: number
  anneesDisponibles?: number[]
  setAnneeActive?: (a: number) => void
}) {
  const [ddOpen, setDdOpen] = React.useState(false)
  const [ddSub, setDdSub] = React.useState<number|null>(null)
  const ddRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ddRef.current && !ddRef.current.contains(e.target as Node)) { setDdOpen(false); setDdSub(null) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const moisCodes = ['01','02','03','04','05','06','07','08','09','10','11','12']

  const labelPeriode = () => {
    if (periodeTab === 'perso' && dateDebut && dateFin) return `${dateDebut.slice(8,10)}/${dateDebut.slice(5,7)} → ${dateFin.slice(8,10)}/${dateFin.slice(5,7)}`
    if (periodeTab === 'exercice') return 'Période complète'
    return labelPer || 'Période complète'
  }

  const selectMois = (annee: number, moisIdx: number) => {
    const m = moisCodes[moisIdx]
    const lastDay = new Date(annee, moisIdx + 1, 0).getDate()
    setPeriodeTab('perso')
    setDateDebut(`${annee}-${m}-01`)
    setDateFin(`${annee}-${m}-${String(lastDay).padStart(2,'0')}`)
    if (setAnneeActive) setAnneeActive(annee)
    setDdOpen(false); setDdSub(null)
  }

  const selectTrimestre = (annee: number, t: number) => {
    const debuts = ['01','04','07','10']
    const fins = ['03','06','09','12']
    const finsJ = [31,30,30,31]
    setPeriodeTab('perso')
    setDateDebut(`${annee}-${debuts[t]}-01`)
    setDateFin(`${annee}-${fins[t]}-${finsJ[t]}`)
    if (setAnneeActive) setAnneeActive(annee)
    setDdOpen(false); setDdSub(null)
  }

  const selectExercice = (annee: number) => {
    setPeriodeTab('exercice')
    if (setAnneeActive) setAnneeActive(annee)
    setDdOpen(false); setDdSub(null)
  }

  const navigueAnnee = (dir: number) => {
    if (!anneesDisponibles || !setAnneeActive) return
    const idx = anneesDisponibles.indexOf(anneeActive ?? anneesDisponibles[0])
    const next = anneesDisponibles[idx + dir]
    if (next !== undefined) { setAnneeActive(next); setPeriodeTab('exercice') }
  }

  const savLabel = sauvegarde === 'saving' ? 'Sauvegarde...' : sauvegarde === 'saved' ? 'Sauvegardé' : sauvegarde === 'error' ? 'Erreur' : null
  const savColor = sauvegarde === 'saved' ? '#0F6E56' : sauvegarde === 'error' ? '#993C1D' : '#8C9BAB'

  const annees = anneesDisponibles ?? []
  const anneeIdx = annees.indexOf(anneeActive ?? annees[0])

  return (
    <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>{titre}</span>
        {hasData && (
          <div ref={ddRef} style={{ position: 'relative' }}>
            {/* Trigger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 7, overflow: 'hidden' }}>
              <button onClick={() => navigueAnnee(-1)} disabled={anneeIdx <= 0} style={{ padding: '5px 8px', background: 'none', border: 'none', cursor: anneeIdx > 0 ? 'pointer' : 'default', color: anneeIdx > 0 ? '#1A1A1A' : '#C8D0DA', fontSize: 12, display: 'flex', alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={() => setDdOpen(o => !o)} style={{ padding: '5px 10px', background: ddOpen ? '#F2F3F5' : '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                {anneeActive ? `Exercice ${anneeActive}` : 'Exercice'} · {labelPeriode()}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: ddOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M2 3.5L5 6.5L8 3.5" stroke="#8C9BAB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={() => navigueAnnee(1)} disabled={anneeIdx >= annees.length - 1} style={{ padding: '5px 8px', background: 'none', border: 'none', cursor: anneeIdx < annees.length - 1 ? 'pointer' : 'default', color: anneeIdx < annees.length - 1 ? '#1A1A1A' : '#C8D0DA', fontSize: 12, display: 'flex', alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            {/* Dropdown */}
            {ddOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 220, overflow: 'hidden' }}>
                {ddSub === null ? (
                  <>
                    {annees.map(a => (
                      <div key={a} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', cursor: 'pointer', background: anneeActive === a ? 'rgba(184,169,138,0.08)' : 'transparent', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}
                        onMouseEnter={e => { if (anneeActive !== a) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = anneeActive === a ? 'rgba(184,169,138,0.08)' : 'transparent' }}
                        onClick={() => setDdSub(a)}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>Exercice {a}</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2L8 6L4 10" stroke="#8C9BAB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    ))}
                    <div style={{ padding: '9px 14px', cursor: 'pointer', borderTop: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F8FA'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      onClick={() => { setPeriodeTab('perso'); setDdOpen(false) }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="13" rx="2" stroke="#8C9BAB" strokeWidth="1.2"/><path d="M5 1v2M11 1v2M1 6h14" stroke="#8C9BAB" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      <span style={{ fontSize: 13, color: '#5C6670' }}>Dates personnalisées</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.07)', cursor: 'pointer' }}
                      onClick={() => setDdSub(null)}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6L8 10" stroke="#8C9BAB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>Exercice {ddSub}</span>
                    </div>
                    <div style={{ padding: '7px 14px', cursor: 'pointer', background: periodeTab === 'exercice' && anneeActive === ddSub ? 'rgba(184,169,138,0.08)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F8FA'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = periodeTab === 'exercice' && anneeActive === ddSub ? 'rgba(184,169,138,0.08)' : 'transparent'}
                      onClick={() => selectExercice(ddSub)}>
                      <span style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 500 }}>Période complète</span>
                    </div>
                    <div style={{ padding: '4px 14px 2px', fontSize: 9, fontWeight: 600, color: '#8C9BAB', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Mois</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, padding: '0 8px 6px' }}>
                      {MOIS.map((m, i) => (
                        <div key={m} style={{ padding: '5px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: '#1A1A1A', textAlign: 'center' as const }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F2F3F5'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          onClick={() => selectMois(ddSub, i)}>{m.slice(0,3)}</div>
                      ))}
                    </div>
                    <div style={{ padding: '4px 14px 2px', fontSize: 9, fontWeight: 600, color: '#8C9BAB', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Trimestres</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, padding: '0 8px 8px' }}>
                      {['T1','T2','T3','T4'].map((t, i) => (
                        <div key={t} style={{ padding: '5px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: '#1A1A1A', textAlign: 'center' as const }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F2F3F5'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          onClick={() => selectTrimestre(ddSub, i)}>{t}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Dates perso inline */}
            {periodeTab === 'perso' && !ddOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 7, padding: '5px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 100 }}>
                <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 5, padding: '3px 7px', fontSize: 11, color: '#1A1A1A', outline: 'none' }} />
                <span style={{ fontSize: 11, color: '#8C9BAB' }}>→</span>
                <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 5, padding: '3px 7px', fontSize: 11, color: '#1A1A1A', outline: 'none' }} />
                <button onClick={() => setPeriodeTab('exercice')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C9BAB', fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            )}
          </div>
        )}
      </div>
      {hasData && nomFichier && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {savLabel && <span style={{ fontSize: 11, color: savColor, fontStyle: 'italic' }}>{savLabel}</span>}
          <span style={{ fontSize: 11, color: '#8C9BAB', fontStyle: 'italic' }}>{nomFichier}</span>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, subBold, accent, delta, onClick }: { label:string; value:string; sub:string; subBold?:boolean; accent:string; delta?: { diff: number; pct: number; couleur: string } | null; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '0.5px solid rgba(0,0,0,0.06)', borderTop: `3px solid ${accent}`, cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {label}
        {onClick && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.1 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 11, color: delta.couleur, marginTop: 4, fontWeight: 500 }}>
          {delta.diff >= 0 ? '+' : ''}{fmt(delta.diff)} ({delta.pct >= 0 ? '+' : ''}{fmtPct(delta.pct)}) vs N-1
        </div>
      )}
      <div style={{ fontSize: 11, color: '#8C9BAB', marginTop: delta ? 2 : 4, fontStyle: 'italic' }}>
        {subBold ? <><strong style={{ color: '#1A1A1A', fontStyle: 'normal', fontWeight: 500 }}>{sub.split(':')[0]}: </strong>{sub.split(':').slice(1).join(':')}</> : sub}
      </div>
    </div>
  )
}

function SigLigne({ nom, codes, valeur, pct, bold, alert, onClick }: { nom:string; codes:string; valeur:number; pct:number; bold?:boolean; alert?:boolean; onClick?:()=>void }) {
  const isPos = valeur > 0
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', padding: '6px 4px', borderBottom: '0.5px solid rgba(0,0,0,0.04)', cursor: onClick ? 'pointer' : 'default', borderRadius: 4 }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.background = '#F7F8FA')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}>
      <div style={{ flex: 1, fontSize: bold ? 13 : 12, fontWeight: bold ? 500 : 400, color: alert ? '#D85A30' : '#1A1A1A' }}>
        {nom} <span style={{ fontSize: 9, color: '#B8A98A', fontWeight: 400 }}>{codes}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: bold ? 500 : 400, color: isPos ? '#1A1A1A' : '#D85A30', minWidth: 90, textAlign: 'right' }}>{fmt(valeur)}</div>
      <div style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic', minWidth: 48, textAlign: 'right' }}>{fmtPct(pct)}</div>
    </div>
  )
}

function SigTotal({ nom, valeur, pct, large }: { nom:string; valeur:number; pct:number; large?:boolean }) {
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
    if (ind.tauxMargebrute > 60)  points.push({ txt: `Marge brute solide a ${fmtPct(ind.tauxMargebrute)}.`, warn: false })
    else if (ind.tauxMargebrute < 30) points.push({ txt: `Marge brute faible a ${fmtPct(ind.tauxMargebrute)} — achats a revoir.`, warn: true })
    if (ind.tauxEbe >= 10) points.push({ txt: `Taux d EBE correct a ${fmtPct(ind.tauxEbe)} du CA.`, warn: false })
    else points.push({ txt: `EBE sous 10 % (${fmtPct(ind.tauxEbe)}) — structure de couts a optimiser.`, warn: true })
    const pctPers = (ind.chargesPersonnel / ind.ca) * 100
    if (pctPers > 50) points.push({ txt: `Masse salariale elevee : ${fmtPct(pctPers)} du CA. Seuil d alerte a 50 %.`, warn: true })
    if (ind.resultatNet < 0) points.push({ txt: `Resultat net negatif (${fmt(ind.resultatNet)}) — situation deficitaire.`, warn: true })
    else if (ind.tauxResultatNet > 5) points.push({ txt: `Bonne rentabilite nette a ${fmtPct(ind.tauxResultatNet)} du CA.`, warn: false })
  }
  if (points.length === 0) return <div style={{ fontSize: 12, color: '#8C9BAB', fontStyle: 'italic' }}>Analyse disponible apres import.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {points.map((p, i) => (
        <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: p.warn ? '#993C1D' : '#1A1A1A' }}>
          {p.warn ? <><strong style={{ fontWeight: 500 }}>! </strong><em style={{ fontStyle: 'normal' }}>{p.txt}</em></> : <><strong style={{ fontWeight: 500, color: '#0F6E56' }}>OK </strong>{p.txt}</>}
        </div>
      ))}
    </div>
  )
}

function DrillPanel({ drill, onClose, onDrill2, onBack }: { drill: DrillData; onClose: ()=>void; onDrill2: (num:string, lib:string)=>void; onBack: ()=>void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, background: '#fff', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {drill.niveau === 2 && (
            <button onClick={(e) => { e.stopPropagation(); onBack() }} style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              ← Retour
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>{drill.titre}</div>
            <div style={{ fontSize: 10, color: '#8C9BAB', fontStyle: 'italic', marginTop: 2 }}>
              {drill.niveau === 1 ? 'Detail par compte — cliquer pour voir les ecritures' : 'Ecritures du grand livre'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8C9BAB', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {drill.niveau === 1 && drill.comptes && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  {['Compte','Libelle','Debit','Credit','Solde'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Compte' || h === 'Libelle' ? 'left' : 'right', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drill.comptes.map(c => (
                  <tr key={c.num} onClick={() => onDrill2(c.num, c.lib)} style={{ borderBottom: '0.5px solid rgba(0,0,0,0.04)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F7F8FA')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
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
          {drill.niveau === 2 && drill.lignes && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  {['Date','Journal','Libelle piece','Debit','Credit'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Date' || h === 'Journal' || h === 'Libelle piece' ? 'left' : 'right', padding: '6px 4px', fontWeight: 500, color: '#8C9BAB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drill.lignes.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                    <td style={{ padding: '6px 4px', color: '#8C9BAB' }}>{l.EcritureDate}</td>
                    <td style={{ padding: '6px 4px', color: '#8C9BAB' }}>{l.JournalCode}</td>
                    <td style={{ padding: '6px 4px', color: '#1A1A1A' }}>{l.EcritureLib || l.PieceRef || '—'}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: l.Debit > 0 ? '#1A1A1A' : '#8C9BAB' }}>{l.Debit > 0 ? fmt(l.Debit) : '—'}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: l.Credit > 0 ? '#1A1A1A' : '#8C9BAB' }}>{l.Credit > 0 ? fmt(l.Credit) : '—'}</td>
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
