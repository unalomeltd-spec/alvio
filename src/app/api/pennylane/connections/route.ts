// ─────────────────────────────────────────────────────────────────────────
// src/app/api/pennylane/connections/route.ts — Lister / supprimer les connexions
//
// GET    ?user_id=...                  → liste les dossiers Pennylane connectés
// DELETE { user_id, connection_id }    → supprime une connexion + son secret Vault
//
// Ne renvoie JAMAIS le token (ni chiffré ni en clair) — uniquement les métadonnées.
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) {
    return NextResponse.json({ erreur: 'Paramètre requis : company_id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('pennylane_connections')
    .select('id, company_name, company_reg_no, created_at, updated_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, connections: data || [] })
}

export async function DELETE(req: NextRequest) {
  let body: { user_id?: string; connection_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erreur: 'Corps de requête invalide' }, { status: 400 })
  }
  const { user_id, connection_id } = body
  if (!user_id || !connection_id) {
    return NextResponse.json({ erreur: 'Paramètres requis : user_id, connection_id' }, { status: 400 })
  }

  // Récupère le secret_id pour pouvoir nettoyer Vault, en vérifiant l'appartenance.
  const { data: conn, error: fetchError } = await supabaseAdmin
    .from('pennylane_connections')
    .select('token_secret_id')
    .eq('id', connection_id)
    .eq('user_id', user_id)
    .single()
  if (fetchError || !conn) {
    return NextResponse.json({ erreur: 'Connexion introuvable' }, { status: 404 })
  }

  // Supprime la ligne de connexion.
  const { error: delError } = await supabaseAdmin
    .from('pennylane_connections')
    .delete()
    .eq('id', connection_id)
    .eq('user_id', user_id)
  if (delError) {
    return NextResponse.json({ erreur: delError.message }, { status: 500 })
  }

  // Nettoie le secret Vault associé (best-effort, ne bloque pas la réponse).
  await supabaseAdmin.rpc('alvio_vault_delete', { p_secret_id: conn.token_secret_id }).then(
    () => {},
    () => {}
  )

  return NextResponse.json({ ok: true })
}
