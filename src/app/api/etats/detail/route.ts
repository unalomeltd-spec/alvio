import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// ALVIO — Drill down comptable
// Retourne les écritures détaillées par préfixe de compte
// Cohérent avec le moteur v3 : même exclusion AN 6/7,
// même normalisation des montants
// ============================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee    = parseInt(searchParams.get('annee')    || '0')
  const companyId = searchParams.get('company_id') || ''
  const prefixes = (searchParams.get('prefixes') || '').split(',').filter(Boolean)

  if (!annee || !companyId || prefixes.length === 0) {
    return NextResponse.json({ erreur: 'annee, company_id et prefixes requis' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from('fec_exercices')
    .select('ecritures')
    .eq('company_id', companyId)
    .eq('annee', annee)
    .single()

  if (error || !data) {
    return NextResponse.json({ erreur: 'FEC introuvable' }, { status: 404 })
  }

  const lignes = data.ecritures as any[]

  const byCompte: Record<string, {
    lib: string
    debit: number
    credit: number
    ecritures: {
      date: string
      lib: string
      piece: string
      debit: number
      credit: number
      journal: string
    }[]
  }> = {}

  for (const l of lignes) {
    const compte  = (l.CompteNum || '').trim()
    const journal = (l.JournalCode || '').trim().toUpperCase()
    const classe  = compte[0]

    if (!compte) continue

    // Même règle d'exclusion que le moteur v3
    if (journal === 'AN' && (classe === '6' || classe === '7')) continue

    if (!prefixes.some(p => compte.startsWith(p))) continue

    // Normalisation montants — même logique que parseLigne() dans le moteur
    const debit  = typeof l.Debit  === 'string' ? parseFloat(l.Debit.replace(',',  '.')) || 0 : (l.Debit  || 0)
    const credit = typeof l.Credit === 'string' ? parseFloat(l.Credit.replace(',', '.')) || 0 : (l.Credit || 0)

    if (!byCompte[compte]) {
      byCompte[compte] = { lib: l.CompteLib || '', debit: 0, credit: 0, ecritures: [] }
    }

    byCompte[compte].debit  += debit
    byCompte[compte].credit += credit
    byCompte[compte].ecritures.push({
      date:    l.EcritureDate || '',
      lib:     l.EcritureLib  || '',
      piece:   l.PieceRef     || '',
      debit:   Math.round(debit  * 100) / 100,
      credit:  Math.round(credit * 100) / 100,
      journal,
    })
  }

  const comptes = Object.entries(byCompte)
    .map(([num, v]) => ({
      num,
      lib:         v.lib,
      debit:       Math.round(v.debit  * 100) / 100,
      credit:      Math.round(v.credit * 100) / 100,
      solde:       Math.round((v.debit - v.credit) * 100) / 100,
      nbEcritures: v.ecritures.length,
      ecritures:   v.ecritures.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter(c => Math.abs(c.solde) > 0.01)
    .sort((a, b) => a.num.localeCompare(b.num))

  return NextResponse.json({ comptes })
}
