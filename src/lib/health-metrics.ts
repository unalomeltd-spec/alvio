// src/lib/health-metrics.ts
//
// Cœur de calcul de la page « Santé financière ».
//
// Fonction pure, stateless : prend les écritures FEC brutes d'un exercice
// et produit les métriques de pilotage (cash, aging clients/fournisseurs,
// délais, indice de fraîcheur, cash mensuel).
//
// Principes (cf. cadrage Valentin) :
//  - Aucune valeur hardcodée. Tout dérive des écritures.
//  - Jamais de NaN ni de zéro silencieux : chaque métrique porte un statut
//    { ok } et, si insuffisante, une raison explicite. La couche UI affiche
//    un fallback texte plutôt qu'un chiffre faux.
//  - Une seule passe de lecture, une seule date de référence pour toutes
//    les vues (la « photo » datée).
//  - Le résultat normalisé (IS / amortissements estimés) N'EST PAS calculé
//    ici : il dépend d'arbitrages comptables non tranchés. Un emplacement
//    est réservé mais reste à l'état « insufficient » tant que la règle
//    n'est pas validée.

// ────────────────────────────────────────────────────────────────────────────
// Types d'entrée
// ────────────────────────────────────────────────────────────────────────────

/** Ligne FEC telle que produite par fec-parser.ts. Champs DGFiP, tous
 *  optionnels au cas où un export tiers en omet : le module dégrade. */
export interface FecLine {
  JournalCode?: string
  EcritureNum?: string
  EcritureDate?: string // AAAAMMJJ ou AAAA-MM-JJ
  CompteNum: string
  CompteLib?: string
  CompAuxNum?: string // code tiers (auxiliaire)
  CompAuxLib?: string // libellé tiers
  PieceRef?: string
  PieceDate?: string
  EcritureLib?: string
  Debit: number
  Credit: number
  EcritureLet?: string // code de lettrage (vide si non lettré)
  DateLet?: string
}

export interface HealthOptions {
  /** Début d'exercice (AAAA-MM-JJ). Si absent, déduit du 1er janvier
   *  de l'année de la date de référence. */
  exerciceDebut?: string
  /** Date « aujourd'hui » comptable. Si absent, prend la date max des
   *  écritures courantes (hors à-nouveaux). */
  dateReference?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Types de sortie
// ────────────────────────────────────────────────────────────────────────────

/** Toute métrique calculable porte un statut. `ok:false` ⇒ la valeur est
 *  absente et `reason` explique pourquoi. Aucune valeur fausse n'est servie. */
export type Metric<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string }

export type AgeBucket = '0-30' | '31-60' | '61-90' | '90+'

export const AGE_BUCKETS: AgeBucket[] = ['0-30', '31-60', '61-90', '90+']

export interface TiersOutstanding {
  tiersId: string // CompAuxNum, sous-compte, ou compte racine selon dispo
  tiersLabel: string
  total: number // solde restant dû (positif)
  bucket: AgeBucket // tranche de la plus ancienne pièce ouverte
  oldestDays: number // ancienneté de la plus ancienne pièce ouverte (jours)
}

export interface AgingResult {
  /** Niveau de finesse réellement atteint, pour transparence UI. */
  resolution: 'tiers' | 'sous-compte' | 'global'
  total: number
  /** Montants agrégés par tranche. */
  byBucket: Record<AgeBucket, number>
  /** Nombre de tiers distincts par tranche. */
  countByBucket: Record<AgeBucket, number>
  /** Détail par tiers (trié du plus ancien au plus récent). */
  tiers: TiersOutstanding[]
  /** Somme des montants dont la pièce la plus ancienne dépasse 60 j. */
  over60: number
}

export interface MonthlyCashPoint {
  month: string // AAAA-MM
  closing: number // solde de trésorerie en fin de mois
}

export interface FreshnessResult {
  lastEntryDate: string // AAAA-MM-JJ
  referenceDate: string
  monthsCovered: number
  monthsElapsed: number
  coverageRatio: number // 0..1
  missingMonths: string[] // AAAA-MM des mois sans saisie suffisante
}

export interface DelaiResult {
  /** Délai brut en jours, NON plafonné. Pour le drill-down. */
  jours: number
  /** false si le ratio n'est pas fiable (volume insuffisant ou exercice
   *  trop jeune). La carte affiche alors une mention dédiée. */
  representatif: boolean
  /** Raison de non-représentativité, le cas échéant. */
  raisonNonRepresentatif?: string
  /** Flux de référence sur la période : CA (clients) ou achats (fournisseurs). */
  flux: number
  /** Solde divisé : créances 411 (clients) ou dettes 401 (fournisseurs). */
  base: number
  /** Diviseur jours réellement employé (= jours écoulés depuis le début
   *  d'exercice). Converge vers 360 à la clôture. */
  joursPeriode: number
}

export interface HealthMetrics {
  referenceDate: string
  exerciceDebut: string

  cash: Metric<number>
  cashMonthly: Metric<MonthlyCashPoint[]>

  agingClients: Metric<AgingResult>
  agingFournisseurs: Metric<AgingResult>

  delaiClients: Metric<DelaiResult>
  delaiFournisseurs: Metric<DelaiResult>

  freshness: Metric<FreshnessResult>

  /** Réservé. En attente de l'arbitrage Valentin sur le résultat normalisé
   *  (injection IS / amortissements / CP estimés). Reste insufficient. */
  resultatNormalise: Metric<number>
}

// ────────────────────────────────────────────────────────────────────────────
// Constantes PCG
// ────────────────────────────────────────────────────────────────────────────

const TRESORERIE_PREFIXES = ['512', '514', '517', '53', '54', '511']
const CLIENTS_PREFIX = '411'
const FOURNISSEURS_PREFIX = '401'
const PRODUITS_EXPLOIT_PREFIX = '70' // ventes pour le délai clients
const ACHATS_PREFIX_60 = '60' // achats
const ACHATS_PREFIX_61 = '61'
const ACHATS_PREFIX_62 = '62' // services extérieurs pour le délai fournisseurs

// Journaux d'à-nouveaux à exclure du « dernier mouvement réel ».
const AN_JOURNAL_RE = /^(an|anouv|ran|a-?nouveau)/i

// ────────────────────────────────────────────────────────────────────────────
// Utilitaires de date
// ────────────────────────────────────────────────────────────────────────────

/** Normalise une date FEC (AAAAMMJJ ou AAAA-MM-JJ) en AAAA-MM-JJ. */
function toIso(d?: string): string {
  if (!d) return ''
  const s = d.trim()
  if (s.includes('-')) return s.slice(0, 10)
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s
}

function parseDate(d?: string): Date | null {
  const iso = toIso(d)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const dt = new Date(iso + 'T00:00:00Z')
  return isNaN(dt.getTime()) ? null : dt
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function bucketOf(days: number): AgeBucket {
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

function emptyBucketRecord(): Record<AgeBucket, number> {
  return { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
}

// ────────────────────────────────────────────────────────────────────────────
// Résolution du tiers
// ────────────────────────────────────────────────────────────────────────────

/** Détermine comment regrouper par tiers selon ce que le FEC fournit :
 *  1) CompAuxNum si présent (cas le plus propre),
 *  2) sinon le sous-compte (411DUPONT) s'il existe sous la racine,
 *  3) sinon regroupement global (un seul « tiers » = le compte racine). */
function resolveTiersResolution(
  lines: FecLine[],
  racine: string
): 'tiers' | 'sous-compte' | 'global' {
  const concerned = lines.filter((l) => l.CompteNum.startsWith(racine))
  if (concerned.length === 0) return 'global'
  const hasAux = concerned.some((l) => (l.CompAuxNum ?? '').trim() !== '')
  if (hasAux) return 'tiers'
  const hasSousCompte = concerned.some((l) => l.CompteNum.length > racine.length)
  if (hasSousCompte) return 'sous-compte'
  return 'global'
}

function tiersKey(
  line: FecLine,
  resolution: 'tiers' | 'sous-compte' | 'global',
  racine: string
): { id: string; label: string } {
  if (resolution === 'tiers') {
    const id = (line.CompAuxNum ?? '').trim() || line.CompteNum
    const label = (line.CompAuxLib ?? '').trim() || line.CompteLib?.trim() || id
    return { id, label }
  }
  if (resolution === 'sous-compte') {
    const id = line.CompteNum
    const label = line.CompteLib?.trim() || id
    return { id, label }
  }
  return { id: racine, label: line.CompteLib?.trim() || racine }
}

// ────────────────────────────────────────────────────────────────────────────
// Aging par lettrage / FIFO
// ────────────────────────────────────────────────────────────────────────────

interface OpenItem {
  date: Date
  remaining: number // montant restant à solder (positif)
}

/**
 * Calcule, pour un tiers, les pièces ouvertes et leur ancienneté.
 *
 * `invoiceSide` indique de quel côté se trouve la facture :
 *  - clients (411) : facture au débit, encaissement au crédit
 *  - fournisseurs (401) : facture au crédit, règlement au débit
 *
 * Stratégie :
 *  - si le FEC utilise le lettrage, on ne garde que les lignes NON lettrées
 *    (les lettrées sont soldées par construction) ;
 *  - sinon on applique un FIFO : les règlements soldent les factures les
 *    plus anciennes d'abord.
 */
function computeOpenItems(
  lines: FecLine[],
  invoiceSide: 'debit' | 'credit',
  usesLettrage: boolean
): OpenItem[] {
  const relevant = usesLettrage
    ? lines.filter((l) => (l.EcritureLet ?? '').trim() === '')
    : lines

  const invoices: OpenItem[] = []
  let paymentPool = 0

  // Montant « facture » et « règlement » selon le sens.
  const invoiceAmount = (l: FecLine) =>
    invoiceSide === 'debit' ? l.Debit - l.Credit : l.Credit - l.Debit

  const dated = relevant
    .map((l) => ({ date: parseDate(l.EcritureDate), amt: invoiceAmount(l) }))
    .filter((x): x is { date: Date; amt: number } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  for (const { date, amt } of dated) {
    if (amt > 0) {
      invoices.push({ date, remaining: amt })
    } else if (amt < 0) {
      paymentPool += -amt
    }
  }

  // FIFO : on consomme les factures les plus anciennes avec les règlements.
  if (paymentPool > 0) {
    for (const inv of invoices) {
      if (paymentPool <= 0) break
      const applied = Math.min(inv.remaining, paymentPool)
      inv.remaining -= applied
      paymentPool -= applied
    }
  }

  return invoices.filter((inv) => inv.remaining > 0.005)
}

function computeAging(
  lines: FecLine[],
  racine: string,
  invoiceSide: 'debit' | 'credit',
  refDate: Date
): Metric<AgingResult> {
  const concerned = lines.filter((l) => l.CompteNum.startsWith(racine))
  if (concerned.length === 0) {
    return { ok: false, reason: `Aucune écriture sur le compte ${racine}.` }
  }

  const resolution = resolveTiersResolution(lines, racine)
  const usesLettrage = concerned.some((l) => (l.EcritureLet ?? '').trim() !== '')

  // Regroupe les lignes par tiers.
  const groups = new Map<string, { label: string; lines: FecLine[] }>()
  for (const l of concerned) {
    const { id, label } = tiersKey(l, resolution, racine)
    const g = groups.get(id)
    if (g) g.lines.push(l)
    else groups.set(id, { label, lines: [l] })
  }

  const byBucket = emptyBucketRecord()
  const countByBucket = emptyBucketRecord()
  const tiers: TiersOutstanding[] = []
  let total = 0
  let over60 = 0

  for (const [id, { label, lines: tlines }] of groups) {
    const open = computeOpenItems(tlines, invoiceSide, usesLettrage)
    if (open.length === 0) continue

    const remaining = open.reduce((s, o) => s + o.remaining, 0)
    if (remaining <= 0.005) continue

    const oldest = open.reduce(
      (acc, o) => (o.date < acc ? o.date : acc),
      open[0].date
    )
    const oldestDays = Math.max(0, daysBetween(oldest, refDate))
    const bucket = bucketOf(oldestDays)

    byBucket[bucket] += remaining
    countByBucket[bucket] += 1
    total += remaining
    if (oldestDays > 60) over60 += remaining

    tiers.push({ tiersId: id, tiersLabel: label, total: remaining, bucket, oldestDays })
  }

  if (tiers.length === 0) {
    return { ok: false, reason: `Aucun solde ouvert sur le compte ${racine}.` }
  }

  tiers.sort((a, b) => b.oldestDays - a.oldestDays)

  return {
    ok: true,
    value: { resolution, total, byBucket, countByBucket, tiers, over60 },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Trésorerie
// ────────────────────────────────────────────────────────────────────────────

function isTresorerie(compteNum: string): boolean {
  return TRESORERIE_PREFIXES.some((p) => compteNum.startsWith(p))
}

function computeCash(lines: FecLine[]): Metric<number> {
  const tres = lines.filter((l) => isTresorerie(l.CompteNum))
  if (tres.length === 0) {
    return { ok: false, reason: 'Aucun compte de trésorerie (512/53…) trouvé.' }
  }
  const solde = tres.reduce((s, l) => s + (l.Debit - l.Credit), 0)
  return { ok: true, value: solde }
}

function computeCashMonthly(
  lines: FecLine[],
  refDate: Date
): Metric<MonthlyCashPoint[]> {
  const tres = lines
    .filter((l) => isTresorerie(l.CompteNum))
    .map((l) => ({ date: parseDate(l.EcritureDate), mvt: l.Debit - l.Credit }))
    .filter((x): x is { date: Date; mvt: number } => x.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (tres.length === 0) {
    return { ok: false, reason: 'Mouvements de trésorerie indisponibles.' }
  }

  // Solde cumulé en fin de chaque mois jusqu'à la date de référence.
  const perMonth = new Map<string, number>()
  let running = 0
  for (const { date, mvt } of tres) {
    if (date > refDate) break
    running += mvt
    perMonth.set(monthKey(date), running)
  }

  // Comble les mois sans mouvement avec le dernier solde connu.
  const first = tres[0].date
  const points: MonthlyCashPoint[] = []
  let cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1))
  let last = 0
  while (cursor <= refDate) {
    const key = monthKey(cursor)
    if (perMonth.has(key)) last = perMonth.get(key)!
    points.push({ month: key, closing: last })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }

  return { ok: true, value: points }
}

// ────────────────────────────────────────────────────────────────────────────
// Délais clients / fournisseurs (en jours)
// ────────────────────────────────────────────────────────────────────────────

function soldeOf(lines: FecLine[], predicate: (c: string) => boolean): number {
  return lines
    .filter((l) => predicate(l.CompteNum))
    .reduce((s, l) => s + (l.Debit - l.Credit), 0)
}

function fluxNet(lines: FecLine[], prefixes: string[]): number {
  // Volume HT de la période pour un poste de produit/charge, en valeur
  // positive (sens naturel respecté via la valeur absolue du solde du poste).
  return lines
    .filter((l) => prefixes.some((p) => l.CompteNum.startsWith(p)))
    .reduce((s, l) => s + Math.abs(l.Credit - l.Debit), 0)
}

/**
 * Délai en jours, calculé en temps réel : base × joursÉcoulés / flux.
 * Le diviseur est le nombre de jours réellement écoulés depuis le début
 * d'exercice (et non 360 fixe), ce qui évite de surévaluer le délai à
 * mi-exercice ; il converge vers ~360 à la clôture.
 *
 * Le résultat n'est jamais plafonné ici (le plafond à 90 j est un choix
 * d'affichage). Le drapeau `representatif` signale les cas où le ratio
 * n'a pas de sens : exercice trop jeune ou volume structurellement faible.
 */
function computeDelai(
  lines: FecLine[],
  basePredicate: (c: string) => boolean,
  fluxPrefixes: string[],
  fluxLabel: 'CA' | 'achats',
  joursEcoules: number
): Metric<DelaiResult> {
  const base = Math.abs(soldeOf(lines, basePredicate))
  const flux = fluxNet(lines, fluxPrefixes)

  if (flux <= 0) {
    return {
      ok: false,
      reason: fluxLabel === 'CA'
        ? 'Chiffre d\'affaires nul ou indisponible.'
        : 'Achats nuls ou indisponibles.',
    }
  }

  const jours = Math.round((base / flux) * joursEcoules)

  // Représentativité — deux gardes indépendantes, sans projection :
  //  1) exercice trop jeune : moins de ~90 jours écoulés → chiffres bruités ;
  //  2) volume insuffisant : le flux de la période est inférieur au solde
  //     qu'il divise (CA < créances, ou achats < dettes), situation
  //     structurellement impossible pour un dossier sain → quasi-nul.
  let representatif = true
  let raison: string | undefined
  if (joursEcoules < 90) {
    representatif = false
    raison = 'Exercice trop récent pour un délai fiable (< 3 mois saisis).'
  } else if (flux < base) {
    representatif = false
    raison = fluxLabel === 'CA'
      ? 'Volume de ventes faible, ratio non représentatif.'
      : 'Volume d\'achats faible, ratio non représentatif.'
  }

  return {
    ok: true,
    value: { jours, representatif, raisonNonRepresentatif: raison, flux, base, joursPeriode: joursEcoules },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Indice de fraîcheur
// ────────────────────────────────────────────────────────────────────────────

function computeFreshness(
  lines: FecLine[],
  exerciceDebut: Date,
  refDate: Date
): Metric<FreshnessResult> {
  // Dernier mouvement « réel » : on exclut les journaux d'à-nouveaux.
  const courantes = lines.filter((l) => !AN_JOURNAL_RE.test(l.JournalCode ?? ''))
  const dates = courantes
    .map((l) => parseDate(l.EcritureDate))
    .filter((d): d is Date => d !== null)
  if (dates.length === 0) {
    return { ok: false, reason: 'Aucune écriture courante datée.' }
  }
  const lastEntry = dates.reduce((a, b) => (b > a ? b : a))

  // Couverture : un mois est « couvert » s'il porte au moins 5 écritures
  // courantes. On compte les mois écoulés depuis le début d'exercice.
  const perMonthCount = new Map<string, number>()
  for (const d of dates) {
    if (d < exerciceDebut || d > refDate) continue
    const k = monthKey(d)
    perMonthCount.set(k, (perMonthCount.get(k) ?? 0) + 1)
  }

  const monthsElapsed: string[] = []
  let cursor = new Date(
    Date.UTC(exerciceDebut.getUTCFullYear(), exerciceDebut.getUTCMonth(), 1)
  )
  const end = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1))
  while (cursor <= end) {
    monthsElapsed.push(monthKey(cursor))
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }

  const covered = monthsElapsed.filter((m) => (perMonthCount.get(m) ?? 0) >= 5)
  const missing = monthsElapsed.filter((m) => (perMonthCount.get(m) ?? 0) < 5)
  const ratio = monthsElapsed.length > 0 ? covered.length / monthsElapsed.length : 0

  return {
    ok: true,
    value: {
      lastEntryDate: monthKey(lastEntry) + '-' + String(lastEntry.getUTCDate()).padStart(2, '0'),
      referenceDate: toIso(refDate.toISOString()),
      monthsCovered: covered.length,
      monthsElapsed: monthsElapsed.length,
      coverageRatio: Math.round(ratio * 100) / 100,
      missingMonths: missing,
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Entrée principale
// ────────────────────────────────────────────────────────────────────────────

export function computeHealthMetrics(
  ecritures: FecLine[],
  options: HealthOptions = {}
): HealthMetrics {
  // Date de référence = date max des écritures courantes, sauf override.
  const courantesDates = ecritures
    .filter((l) => !AN_JOURNAL_RE.test(l.JournalCode ?? ''))
    .map((l) => parseDate(l.EcritureDate))
    .filter((d): d is Date => d !== null)

  const refDate =
    parseDate(options.dateReference) ??
    (courantesDates.length > 0
      ? courantesDates.reduce((a, b) => (b > a ? b : a))
      : new Date())

  const exerciceDebut =
    parseDate(options.exerciceDebut) ??
    new Date(Date.UTC(refDate.getUTCFullYear(), 0, 1))

  // Jours écoulés depuis le début d'exercice (diviseur des délais en temps réel).
  const joursEcoules = Math.max(1, daysBetween(exerciceDebut, refDate))

  return {
    referenceDate: toIso(refDate.toISOString()),
    exerciceDebut: toIso(exerciceDebut.toISOString()),

    cash: computeCash(ecritures),
    cashMonthly: computeCashMonthly(ecritures, refDate),

    agingClients: computeAging(ecritures, CLIENTS_PREFIX, 'debit', refDate),
    agingFournisseurs: computeAging(ecritures, FOURNISSEURS_PREFIX, 'credit', refDate),

    delaiClients: computeDelai(
      ecritures,
      (c) => c.startsWith(CLIENTS_PREFIX),
      [PRODUITS_EXPLOIT_PREFIX],
      'CA',
      joursEcoules
    ),
    delaiFournisseurs: computeDelai(
      ecritures,
      (c) => c.startsWith(FOURNISSEURS_PREFIX),
      [ACHATS_PREFIX_60, ACHATS_PREFIX_61, ACHATS_PREFIX_62],
      'achats',
      joursEcoules
    ),

    freshness: computeFreshness(ecritures, exerciceDebut, refDate),

    // En attente d'arbitrage comptable (IS / amortissements estimés).
    resultatNormalise: {
      ok: false,
      reason: 'Résultat normalisé en attente de validation de la règle d\'estimation.',
    },
  }
}
