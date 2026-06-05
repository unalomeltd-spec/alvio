import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee = parseInt(searchParams.get('annee') || '0')
  const userId = searchParams.get('user_id') || ''
  const prefixes = (searchParams.get('prefixes') || '').split(',').filter(Boolean)

  if (!annee || !userId || prefixes.length === 0) {
    return NextResponse.json({ erreur: 'annee, user_id et prefixes requis' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from('fec_exercices')
    .select('ecritures')
    .eq('user_id', userId)
    .eq('annee', annee)
    .single()

  if (error || !data) {
    return NextResponse.json({ erreur: 'FEC introuvable' }, { status: 404 })
  }

  const lignes = data.ecritures as any[]

  // Filtrer les lignes qui correspondent aux préfixes demandés
  // Exclure les AN pour les classes 6 et 7
  const byCompte: Record<string, { lib: string; debit: number; credit: number; ecritures: any[] }> = {}

  for (const l of lignes) {
    const compte = l.CompteNum || ''
    const journal = l.JournalCode || ''
    const classe = compte[0]

    // Exclure AN des classes 6 et 7
    if (journal === 'AN' && (classe === '6' || classe === '7')) continue

    const match = prefixes.some(p => compte.startsWith(p))
    if (!match) continue

    if (!byCompte[compte]) {
      byCompte[compte] = { lib: l.CompteLib || '', debit: 0, credit: 0, ecritures: [] }
    }
    byCompte[compte].debit += l.Debit || 0
    byCompte[compte].credit += l.Credit || 0
    byCompte[compte].ecritures.push({
      date: l.EcritureDate || '',
      lib: l.EcritureLib || '',
      piece: l.PieceRef || '',
      debit: l.Debit || 0,
      credit: l.Credit || 0,
      journal: l.JournalCode || '',
    })
  }

  // Construire la réponse
  const comptes = Object.entries(byCompte)
    .map(([num, v]) => ({
      num,
      lib: v.lib,
      debit: Math.round(v.debit * 100) / 100,
      credit: Math.round(v.credit * 100) / 100,
      solde: Math.round((v.debit - v.credit) * 100) / 100,
      nbEcritures: v.ecritures.length,
      ecritures: v.ecritures.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter(c => Math.abs(c.solde) > 0.01)
    .sort((a, b) => a.num.localeCompare(b.num))

  return NextResponse.json({ comptes })
}
