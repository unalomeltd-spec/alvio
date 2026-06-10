// ─────────────────────────────────────────────────────────────────────────
// src/app/api/pennylane/sync/route.ts — Synchronisation FEC via API Pennylane
//
// Workflow asynchrone Pennylane (validé le 10/06/2026) :
//   1. POST /exports/fecs { period_start, period_end }  → { id, status: pending }
//   2. GET  /exports/fecs/{id} (polling)                → { status: ready, file_url }
//   3. GET  file_url                                    → FEC brut (texte TSV)
//   4. parseFEC(text)  →  upsert dans fec_exercices
//
// Le token Pennylane transite UNIQUEMENT côté serveur (jamais exposé client).
// V1 : token passé dans le body. V2 : lecture depuis stockage chiffré (Vault).
// ─────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseFEC, detectAnnee } from '@/lib/fec-parser'

const PENNYLANE_BASE = 'https://app.pennylane.com/api/external/v2'

// Client admin (service role) — écriture serveur dans fec_exercices.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

interface SyncBody {
  user_id: string
  token: string
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

  const { user_id, token, period_start, period_end } = body
  if (!user_id || !token || !period_start || !period_end) {
    return NextResponse.json(
      { erreur: 'Paramètres requis : user_id, token, period_start, period_end' },
      { status: 400 }
    )
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  try {
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
    // Export observé prêt en ~5s ; on tente jusqu'à ~30s (10 essais espacés de 3s).
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

    // Nom de fichier conventionnel basé sur la période.
    const nomFichier = `Pennylane_FEC_${period_start}_${period_end}.txt`
    const annee = detectAnnee(lignes, `FEC${period_start.slice(0, 4)}`)

    const { error: upsertError } = await supabaseAdmin
      .from('fec_exercices')
      .upsert(
        { user_id, annee, ecritures: lignes, nom_fichier: nomFichier },
        { onConflict: 'user_id,annee' }
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
