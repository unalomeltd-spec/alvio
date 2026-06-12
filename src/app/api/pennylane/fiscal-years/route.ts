// ─────────────────────────────────────────────────────────────────────────
// src/app/api/pennylane/fiscal-years/route.ts
//
// GET /api/pennylane/fiscal-years?connection_id=...&user_id=...
//
// Récupère les exercices fiscaux réels depuis l'API Pennylane.
// Réponse Pennylane réelle : { items: [{ id, start, finish, status }] }
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PENNYLANE_BASE = 'https://app.pennylane.com/api/external/v2'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface FiscalYear {
  id: string
  start_date: string   // 'YYYY-MM-DD'
  end_date: string     // 'YYYY-MM-DD'
  closed: boolean
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const connection_id = searchParams.get('connection_id')
  const user_id = searchParams.get('user_id')

  if (!connection_id || !user_id) {
    return NextResponse.json(
      { erreur: 'Paramètres requis : connection_id, user_id' },
      { status: 400 }
    )
  }

  try {
    // ── Récupérer + déchiffrer le token ───────────────────────────────────
    const { data: conn, error: connError } = await supabaseAdmin
      .from('pennylane_connections')
      .select('token_secret_id')
      .eq('id', connection_id)
      .eq('user_id', user_id)
      .single()

    if (connError || !conn) {
      return NextResponse.json({ erreur: 'Connexion Pennylane introuvable' }, { status: 404 })
    }

    const { data: token, error: vaultError } = await supabaseAdmin
      .rpc('alvio_vault_read', { p_secret_id: conn.token_secret_id })

    if (vaultError || !token) {
      return NextResponse.json({ erreur: 'Échec de la lecture du token sécurisé' }, { status: 500 })
    }

    // ── Appel Pennylane fiscal_years ───────────────────────────────────────
    const res = await fetch(`${PENNYLANE_BASE}/fiscal_years`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json(
        { erreur: `Pennylane a refusé la demande (${res.status})`, detail: txt.slice(0, 300) },
        { status: 502 }
      )
    }

    const data = await res.json()

    // Réponse réelle Pennylane : { items: [{ id, start, finish, status }] }
    const raw: any[] = Array.isArray(data) ? data : (data.items ?? data.fiscal_years ?? [])

    // Normaliser vers le format interne Alvio
    const fiscalYears: FiscalYear[] = raw.map(fy => ({
      id: String(fy.id),
      start_date: fy.start ?? fy.start_date,
      end_date: fy.finish ?? fy.end_date,
      closed: (fy.status ?? '') === 'closed',
    }))

    // Trier du plus récent au plus ancien
    fiscalYears.sort((a, b) => b.start_date.localeCompare(a.start_date))

    return NextResponse.json({ fiscal_years: fiscalYears })
  } catch (e: any) {
    return NextResponse.json(
      { erreur: 'Erreur interne', detail: String(e?.message || e).slice(0, 300) },
      { status: 500 }
    )
  }
}
