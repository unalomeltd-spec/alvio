// ─────────────────────────────────────────────────────────────────────────
// src/app/api/pennylane/sync/route.ts — Synchronisation FEC via API Pennylane
//
// V2 : le token n'est plus passé en clair. La route reçoit un connection_id,
// récupère le token_secret_id depuis pennylane_connections, et déchiffre le
// token via Vault (public.alvio_vault_read) — uniquement côté serveur.
//
// Workflow Pennylane (validé 10/06/2026) :
//   1. POST /exports/fecs { period_start, period_end }  → { id, status: pending }
//   2. GET  /exports/fecs/{id} (polling)                → { status: ready, file_url }
//   3. GET  file_url                                    → FEC brut (TSV)
//   4. parseFEC(text)  →  upsert dans fec_exercices
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseFEC, detectExercice } from '@/lib/fec-parser'

const PENNYLANE_BASE = 'https://app.pennylane.com/api/external/v2'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

interface SyncBody {
  user_id: string
  connection_id: string
  period_start: string   // 'YYYY-MM-DD'
  period_end: string     // 'YYYY-MM-DD'
}

export async function POST(req: NextRequest) {
  let body: SyncBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erreur: 'Corps de requête invalide' }, { status: 400 })
  }

  const { user_id, connection_id, period_start, period_end } = body
  if (!user_id || !connection_id || !period_start || !period_end) {
    return NextResponse.json(
      { erreur: 'Paramètres requis : user_id, connection_id, period_start, period_end' },
      { status: 400 }
    )
  }

  try {
    // ── Étape 0 : récupérer + déchiffrer le token via Vault ───────────────
    const { data: conn, error: connError } = await supabaseAdmin
      .from('pennylane_connections')
      .select('token_secret_id, company_id')
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

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // ── Étape 1 : créer l'export FEC ──────────────────────────────────────
    const createRes = await fetch(`${PENNYLANE_BASE}/exports/fecs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ period_start, period_end }),
    })
    if (!createRes.ok) {
      const txt = await createRes.text()
      return NextResponse.json(
        { erreur: `Pennylane a refusé la création de l'export (${createRes.status})`, detail: txt.slice(0, 300) },
        { status: 502 }
      )
    }
    const createData = await createRes.json()
    const exportId = createData?.id
    if (!exportId) {
      return NextResponse.json({ erreur: "Pennylane n'a pas renvoyé d'identifiant d'export" }, { status: 502 })
    }

    // ── Étape 2 : polling jusqu'à status "ready" ──────────────────────────
    let fileUrl: string | null = null
    for (let attempt = 0; attempt < 10; attempt++) {
      await sleep(3000)
      const statusRes = await fetch(`${PENNYLANE_BASE}/exports/fecs/${exportId}`, { headers })
      if (!statusRes.ok) continue
      const statusData = await statusRes.json()
      if (statusData?.status === 'ready' && statusData?.file_url) {
        fileUrl = statusData.file_url
        break
      }
      if (statusData?.status === 'failed' || statusData?.status === 'error') {
        return NextResponse.json({ erreur: "L'export Pennylane a échoué" }, { status: 502 })
      }
    }
    if (!fileUrl) {
      return NextResponse.json(
        { erreur: "L'export Pennylane n'était pas prêt après 30s. Réessayez." },
        { status: 504 }
      )
    }

    // ── Étape 3 : télécharger le FEC ──────────────────────────────────────
    const fecRes = await fetch(fileUrl, { headers: { 'Authorization': `Bearer ${token}` } })
    if (!fecRes.ok) {
      return NextResponse.json({ erreur: 'Échec du téléchargement du FEC Pennylane' }, { status: 502 })
    }
    const fecText = await fecRes.text()

    // ── Étape 4 : parser (module partagé) + upsert ────────────────────────
    const { lignes, erreur } = parseFEC(fecText)
    if (erreur) {
      return NextResponse.json({ erreur: `FEC Pennylane illisible : ${erreur}` }, { status: 422 })
    }

    const nomFichier = `Pennylane_FEC_${period_start}_${period_end}.txt`
    // Pennylane fournit les bornes exactes de l'exercice : on les écrit telles quelles.
    // annee = millésime de la clôture (period_end) ; repli detectExercice.
    const annee = parseInt(period_end.slice(0, 4)) || detectExercice(lignes, period_end).annee

    const { error: upsertError } = await supabaseAdmin
      .from('fec_exercices')
      .upsert(
        { user_id, company_id: conn.company_id, annee, ecritures: lignes, nom_fichier: nomFichier, date_debut: period_start, date_fin: period_end },
        { onConflict: 'company_id,annee' }
      )
    if (upsertError) {
      return NextResponse.json({ erreur: `Échec de l'enregistrement : ${upsertError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      annee,
      nb_ecritures: lignes.length,
      nom_fichier: nomFichier,
      source: 'pennylane',
    })
  } catch (e: any) {
    return NextResponse.json(
      { erreur: 'Erreur interne lors de la synchronisation Pennylane', detail: String(e?.message || e).slice(0, 300) },
      { status: 500 }
    )
  }
}
