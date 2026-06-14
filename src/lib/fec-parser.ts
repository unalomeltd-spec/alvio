// ─────────────────────────────────────────────────────────────────────────
// src/lib/fec-parser.ts — Parser FEC partagé (source unique de vérité)
//
// Utilisé par :
//   • src/app/entreprise/page.tsx  (upload manuel d'un fichier FEC)
//   • src/app/api/pennylane/sync/route.ts  (sync via API Pennylane)
//
// Fonction pure, stateless, sans dépendance React/Supabase — testable
// unitairement et intégrable au harnais de non-régression (Phase 0).
// ─────────────────────────────────────────────────────────────────────────

export interface LigneFEC {
  EcritureDate: string
  CompteNum:    string
  CompteLib:    string
  CompAuxNum:   string
  CompAuxLib:   string
  JournalCode:  string
  JournalLib:   string
  EcritureNum:  string
  EcritureLib:  string
  PieceRef:     string
  PieceDate:    string
  Debit:        number
  Credit:       number
}

export interface ParseResult {
  lignes: LigneFEC[]
  /** Erreur de format si non null (ex. colonnes obligatoires absentes). */
  erreur: string | null
  /** En-têtes détectés dans le fichier source (utile pour message d'erreur). */
  header: string[]
}

/**
 * Parse un FEC brut (texte) en lignes structurées.
 * Détecte automatiquement le séparateur (tabulation, point-virgule, pipe)
 * et résout les colonnes par nom exact puis par correspondance partielle.
 *
 * Aucune supposition sur l'origine du fichier : gère les exports DGFiP
 * standard (18 colonnes) comme les exports partiels de logiciels tiers.
 */
export function parseFEC(text: string): ParseResult {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) {
    return { lignes: [], erreur: 'Fichier vide ou illisible', header: [] }
  }

  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : '|'
  const header = lines[0].split(sep).map(h => h.trim().replace(/"/g, ''))

  const getIdx = (exactNames: string[], partialNames: string[]): number => {
    for (const n of exactNames) {
      const i = header.findIndex(h => h.toLowerCase() === n.toLowerCase())
      if (i >= 0) return i
    }
    for (const n of partialNames) {
      const i = header.findIndex(h => h.toLowerCase().includes(n.toLowerCase()))
      if (i >= 0) return i
    }
    return -1
  }

  const iDate     = getIdx(['EcritureDate'], ['ecrituredate', 'datepiece', 'date'])
  const iCompte   = getIdx(['CompteNum'], ['comptenum', 'compte'])
  const iLib      = getIdx(['CompteLib'], ['comptelib', 'libellecompte'])
  const iEcLib    = getIdx(['EcritureLib'], ['ecriturelib', 'libelle'])
  const iPiece    = getIdx(['PieceRef'], ['pieceref', 'piece'])
  const iDebit    = getIdx(['Debit', 'MontantDebit'], ['debit', 'montantdebit'])
  const iCredit   = getIdx(['Credit', 'MontantCredit'], ['credit', 'montantcredit'])
  const iAux      = getIdx(['CompAuxNum'], ['compauxnum', 'auxnum', 'comptea'])
  const iAuxLib   = getIdx(['CompAuxLib'], ['compauxlib', 'auxlib'])
  const iJournal  = getIdx(['JournalCode'], ['journalcode', 'journal', 'codejournal'])
  const iJournalL = getIdx(['JournalLib'], ['journallib', 'libellejournal'])
  const iEcNum    = getIdx(['EcritureNum'], ['ecriturenum', 'numpiece', 'numero'])
  const iPieceD   = getIdx(['PieceDate'], ['piecedate', 'datepiece'])

  if (iDate < 0 || iCompte < 0) {
    return {
      lignes: [],
      erreur: 'Format FEC non reconnu — colonnes : ' + header.join(', '),
      header,
    }
  }

  const lignes: LigneFEC[] = lines.slice(1).flatMap(l => {
    const cols = l.split(sep).map(c => c.trim().replace(/"/g, ''))
    const compteNum = cols[iCompte] || ''
    if (!compteNum) return []
    const debit  = parseFloat((cols[iDebit]  || '0').replace(',', '.')) || 0
    const credit = parseFloat((cols[iCredit] || '0').replace(',', '.')) || 0
    return [{
      EcritureDate: cols[iDate]     || '',
      CompteNum:    compteNum,
      CompteLib:    iLib      >= 0 ? (cols[iLib]      || '') : '',
      CompAuxNum:   iAux      >= 0 ? (cols[iAux]      || '') : '',
      CompAuxLib:   iAuxLib   >= 0 ? (cols[iAuxLib]   || '') : '',
      JournalCode:  iJournal  >= 0 ? (cols[iJournal]  || '') : '',
      JournalLib:   iJournalL >= 0 ? (cols[iJournalL] || '') : '',
      EcritureNum:  iEcNum    >= 0 ? (cols[iEcNum]    || '') : '',
      EcritureLib:  iEcLib    >= 0 ? (cols[iEcLib]    || '') : '',
      PieceRef:     iPiece    >= 0 ? (cols[iPiece]    || '') : '',
      PieceDate:    iPieceD   >= 0 ? (cols[iPieceD]   || '') : '',
      Debit:  debit,
      Credit: credit,
    }]
  })

  if (lignes.length === 0) {
    return { lignes: [], erreur: 'Aucune écriture valide trouvée', header }
  }

  return { lignes, erreur: null, header }
}

export interface ExerciceBornes {
  /** Année de la clôture (millésime) = year(dateFin). Reste la clé de fec_exercices. */
  annee: number
  /** Ouverture (1er jour) au format YYYY-MM-DD, ou null si indéterminable. */
  dateDebut: string | null
  /** Clôture (dernier jour) au format YYYY-MM-DD, ou null si indéterminable. */
  dateFin: string | null
}

/**
 * Bornes de l'exercice à partir des dates d'écriture du FEC.
 *   • dateFin   = dernière EcritureDate (OD de clôture)
 *   • dateDebut = première EcritureDate (les à-nouveaux marquent l'ouverture)
 *   • annee     = année de la clôture ; repli nom de fichier (FECYYYY) puis année courante.
 * Gère nativement les exercices à cheval (ex. 01/07/N → 30/06/N+1).
 */
export function detectExercice(lignes: LigneFEC[], fileName: string): ExerciceBornes {
  const normalize = (d: string) =>
    d.includes('-') ? d.slice(0, 10) : `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`

  let min: string | null = null
  let max: string | null = null
  for (const l of lignes) {
    const raw = l.EcritureDate
    if (!raw || raw.length < 8) continue
    const d = normalize(raw)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    if (min === null || d < min) min = d   // ISO -> comparaison lexicale = chronologique
    if (max === null || d > max) max = d
  }

  let annee: number | null = null
  if (max) {
    const parsed = parseInt(max.slice(0, 4))
    if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2100) annee = parsed
  }
  if (annee === null) {
    const m = fileName.match(/FEC(\d{4})/)
    annee = m ? parseInt(m[1]) : new Date().getFullYear()
  }

  return { annee, dateDebut: min, dateFin: max }
}

/** @deprecated conservé pour compat — préférer detectExercice(). */
export function detectAnnee(lignes: LigneFEC[], fileName: string): number {
  return detectExercice(lignes, fileName).annee
}
