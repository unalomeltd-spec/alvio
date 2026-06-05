import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee = parseInt(searchParams.get('annee') || '0')
  const userId = searchParams.get('user_id') || ''

  if (!annee || !userId) {
    return NextResponse.json({ erreur: 'annee et user_id requis' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.rpc('calculer_etats', {
    p_user_id: userId,
    p_annee: annee
  })

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json(data)
}
