// ⚠️ SERVEUR UNIQUEMENT : accès à Supabase depuis les routes app/api/…
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Client avec la clé SECRÈTE (SUPABASE_SECRET_KEY) : il passe outre les règles RLS.
// On ne l'utilise que pour appeler les fonctions réservées au serveur (paiement, emails).
export function getSupabaseServeur(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.SUPABASE_SECRET_KEY
  if (!url || !cle) return null
  return createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Qui fait la demande ? On vérifie le jeton de connexion envoyé par le navigateur.
export type Utilisateur = { id: string; email: string | null; nom: string | null }

export async function utilisateurConnecte(request: Request): Promise<Utilisateur | null> {
  const jeton = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!jeton || !url || !cleAnon) return null
  const supabase = createClient(url, cleAnon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.auth.getUser(jeton)
  if (error || !data.user) return null
  const nom = data.user.user_metadata?.nom_complet
  return { id: data.user.id, email: data.user.email ?? null, nom: typeof nom === 'string' && nom.trim() ? nom.trim() : null }
}
