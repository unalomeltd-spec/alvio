// ─────────────────────────────────────────────────────────────────────────
// src/lib/supabase/server.ts — Client Supabase CÔTÉ SERVEUR
//
// Lit la session de l'utilisateur depuis les cookies de la requête.
// Deux usages :
//
//   1. createClient()  → client AUTHENTIFIÉ (clé anon + session cookie).
//      Les RLS s'appliquent : ce client ne voit QUE les données de l'utilisateur
//      connecté. C'est le client à utiliser par défaut dans les routes API.
//
//   2. createAdminClient()  → client SERVICE ROLE (bypass RLS).
//      À n'utiliser QUE pour les opérations qui l'exigent réellement
//      (ex. Vault), et TOUJOURS après avoir vérifié l'identité + l'appartenance.
// ─────────────────────────────────────────────────────────────────────────

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Client authentifié (RLS appliquées) — usage par défaut côté serveur
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Appelé depuis un Server Component : ignoré, le middleware rafraîchit.
          }
        },
      },
    }
  )
}

// Client service role (bypass RLS) — réservé aux opérations privilégiées (Vault)
// À n'appeler QU'APRÈS vérification de l'identité et de l'appartenance.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
