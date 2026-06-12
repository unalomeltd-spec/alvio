// ─────────────────────────────────────────────────────────────────────────
// src/lib/supabase/client.ts — Client Supabase CÔTÉ NAVIGATEUR
//
// Utilise @supabase/ssr : la session est stockée dans des COOKIES (et non plus
// dans le localStorage). C'est ce qui permet au serveur (middleware + routes API)
// de lire la session de l'utilisateur et donc d'appliquer les RLS automatiquement.
//
// Usage dans un composant client :
//   import { createClient } from '@/lib/supabase/client'
//   const supabase = createClient()
// ─────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
