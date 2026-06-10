// ─────────────────────────────────────────────────────────────────────────
// src/app/api/pennylane/connect/route.ts — Enregistrer une connexion Pennylane
//
// Workflow :
//   1. Valide le token via GET /me (récupère nom + SIREN du dossier)
//   2. Stocke le token CHIFFRÉ dans Vault (public.alvio_vault_create)
//   3. Enregistre la connexion (référence au secret) dans pennylane_connections
//
// Le token en clair ne quitte jamais le serveur et n'est jamais stocké en clair.
// Toutes les opérations Vault / table passent par le service role (bypass RLS).
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PENNYLANE_BASE = 'https://app.pennylane.com/api/external/v2'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ConnectBody {
  user_id: string
  token: string
}

export async function POST(req: NextRequest) {
  let body: ConnectBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erreur: 'Corps de requête invalide' }, { status: 400 })
  }

  const { user_id, token } = body
  if (!user_id || !token) {
    return NextResponse.json({ erreur: 'Paramètres requis : user_id, token' }, { status: 400 })
  }
  const cleanToken = token.trim()

  try {
    // ── Étape 1 : valider le token et identifier le dossier ───────────────
    const meRes = await fetch(`${PENNYLANE_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${cleanToken}`, 'Content-Type': 'application/json' },
    })
    if (!meRes.ok) {
      return NextResponse.json({ erreur: 'Token Pennylane invalide ou expiré' }, { status: 401 })
    }
    const me = await meRes.json()
    const companyName  = me?.company?.name || 'Dossier Pennylane'
    const companyRegNo = me?.company?.reg_no || ''

    // ── Étape 2 : stocker le token chiffré dans Vault ─────────────────────
    const secretName = `pennylane_token_${user_id}_${companyRegNo || Date.now()}`
    const { data: secretId, error: vaultError } = await supabaseAdmin
      .rpc('alvio_vault_create', {
        p_secret: cleanToken,
        p_name: secretName,
        p_description: `Token Pennylane — ${companyName} (${companyRegNo})`,
      })
    if (vaultError || !secretId) {
      return NextResponse.json(
        { erreur: `Échec du stockage sécurisé : ${vaultError?.message || 'inconnu'}` },
        { status: 500 }
      )
    }

    // ── Étape 3 : enregistrer la connexion (upsert sur user + SIREN) ──────
    const { data: connection, error: connError } = await supabaseAdmin
      .from('pennylane_connections')
      .upsert(
        {
          user_id,
          company_name: companyName,
          company_reg_no: companyRegNo,
          token_secret_id: secretId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,company_reg_no' }
      )
      .select('id, company_name, company_reg_no')
      .single()
    if (connError) {
      return NextResponse.json(
        { erreur: `Échec de l'enregistrement de la connexion : ${connError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      connection_id: connection.id,
      company_name: connection.company_name,
      company_reg_no: connection.company_reg_no,
    })
  } catch (e: any) {
    return NextResponse.json(
      { erreur: 'Erreur interne lors de la connexion Pennylane', detail: String(e?.message || e).slice(0, 300) },
      { status: 500 }
    )
  }
}
