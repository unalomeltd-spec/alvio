import { createClient } from '@supabase/supabase-js'

// Lazy init — safe at build time when env vars are placeholder
let _supabase: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}

// Convenience re-export — only call at runtime (inside useEffect / event handlers)
export const supabase = {
  auth: {
    getUser:                  (...a: Parameters<ReturnType<typeof createClient>['auth']['getUser']>) => getSupabase().auth.getUser(...a),
    signInWithPassword:       (...a: Parameters<ReturnType<typeof createClient>['auth']['signInWithPassword']>) => getSupabase().auth.signInWithPassword(...a),
    signUp:                   (...a: Parameters<ReturnType<typeof createClient>['auth']['signUp']>) => getSupabase().auth.signUp(...a),
    signOut:                  (...a: Parameters<ReturnType<typeof createClient>['auth']['signOut']>) => getSupabase().auth.signOut(...a),
    resetPasswordForEmail:    (...a: Parameters<ReturnType<typeof createClient>['auth']['resetPasswordForEmail']>) => getSupabase().auth.resetPasswordForEmail(...a),
  },
}
