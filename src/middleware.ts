// ─────────────────────────────────────────────────────────────────────────
// src/middleware.ts — Rafraîchissement de session sur chaque requête
//
// Indispensable avec @supabase/ssr : à chaque navigation, le middleware
// rafraîchit le token de session et réécrit les cookies. Sans lui, la session
// expire côté serveur et les routes API ne peuvent plus identifier l'utilisateur.
//
// NOTE : ce middleware est INERTE tant que les pages utilisent encore l'ancien
// client localStorage (étape 1). Il devient actif une fois les pages migrées
// sur la session cookie (étape 2). Il ne casse rien dans l'intervalle.
// ─────────────────────────────────────────────────────────────────────────

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchit la session (ne pas retirer cet appel)
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et les images
    '/((?!_next/static|_next/image|favicon.ico|apple-icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
