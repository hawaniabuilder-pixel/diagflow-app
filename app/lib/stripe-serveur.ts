// ⚠️ SERVEUR UNIQUEMENT : ce fichier utilise des clés SECRÈTES (Stripe et Supabase).
// Il est importé seulement par les routes app/api/stripe/… — jamais par une page.
//
// Les clés se mettent dans .env.local (jamais dans le code) :
//   STRIPE_SECRET_KEY      clé secrète Stripe (sk_test_… pour les essais, sk_live_… pour de vrai)
//   STRIPE_WEBHOOK_SECRET  secret du webhook (whsec_…)
//   STRIPE_PRICE_EQUIPE    identifiant du prix de l'offre Équipe, 99 €/mois (price_…)
//   STRIPE_PRICE_SOLO      identifiant du prix de l'offre Solo, 29 €/mois (price_…)
//   SUPABASE_SECRET_KEY    clé secrète Supabase (sb_secret_… ou l'ancienne « service_role »)
import Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServeur } from './supabase-serveur'

export { getSupabaseServeur } // (défini dans supabase-serveur.ts, partagé avec les emails)

const logErreur = (...args: unknown[]) => console.error('[stripe]', ...args)

export function erreur(message: string, status: number) {
  return Response.json({ success: false, error: message }, { status })
}

// --- Les 2 clients « serveur » ---------------------------------------------
let clientStripe: Stripe | null = null
export function getStripe(): Stripe | null {
  const cle = process.env.STRIPE_SECRET_KEY
  if (!cle) return null
  if (!clientStripe) clientStripe = new Stripe(cle)
  return clientStripe
}


// Message clair si une clé manque dans .env.local
export function configurationManquante(prix: 'STRIPE_PRICE_EQUIPE' | 'STRIPE_PRICE_SOLO' = 'STRIPE_PRICE_EQUIPE'): string | null {
  const manquantes = ['STRIPE_SECRET_KEY', prix, 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_SUPABASE_URL']
    .filter((nom) => !process.env[nom])
  if (manquantes.length === 0) return null
  logErreur('Variables manquantes dans .env.local :', manquantes.join(', '))
  return `Le paiement n’est pas encore configuré (il manque dans .env.local : ${manquantes.join(', ')}).`
}

// --- Qui fait la demande ? Il doit être connecté ET Admin de son équipe -----------
export type EquipeAdmin = { id: string; nom: string; essai_jusqu_au: string }

export async function adminConnecte(request: Request): Promise<
  { ok: true; equipe: EquipeAdmin; email: string | null } | { ok: false; response: Response }
> {
  const jeton = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!jeton) return { ok: false, response: erreur('Connectez-vous d’abord.', 401) }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !cleAnon) return { ok: false, response: erreur('La configuration Supabase est incomplète.', 500) }

  // Client « au nom » de la personne : les règles de sécurité normales s'appliquent
  const supabase = createClient(url, cleAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  })
  const { data: utilisateur, error: erreurUtilisateur } = await supabase.auth.getUser(jeton)
  if (erreurUtilisateur || !utilisateur.user) return { ok: false, response: erreur('Votre session a expiré. Reconnectez-vous.', 401) }

  const { data, error } = await supabase.rpc('mon_equipe_resume')
  const ligne = (Array.isArray(data) ? data[0] : data) as { id: string; nom: string; mon_role: string; essai_jusqu_au: string } | null
  if (error || !ligne) return { ok: false, response: erreur('Créez d’abord votre équipe (page Équipe).', 403) }
  if (ligne.mon_role !== 'admin') return { ok: false, response: erreur('Seul un Admin de l’équipe peut gérer le paiement.', 403) }

  return { ok: true, equipe: { id: ligne.id, nom: ligne.nom, essai_jusqu_au: ligne.essai_jusqu_au }, email: utilisateur.user.email ?? null }
}

// --- Abonnement enregistré pour une équipe --------------------------------------
export type LigneAbonnement = {
  equipe_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  statut: string | null
  fin_periode: string | null
  annulation_prevue: boolean
}

export async function lireAbonnement(supabase: SupabaseClient, equipeId: string): Promise<LigneAbonnement | null> {
  const { data, error } = await supabase.from('abonnements_stripe').select('*').eq('equipe_id', equipeId).maybeSingle()
  if (error) {
    logErreur('Lecture de l’abonnement impossible :', error.message)
    throw new Error(/does not exist|schema cache/i.test(error.message)
      ? 'Le paiement n’est pas encore installé : exécutez supabase/11_paiement_stripe.sql dans Supabase.'
      : 'Lecture de l’abonnement impossible. Réessayez.')
  }
  return (data as LigneAbonnement | null) ?? null
}

export const STATUTS_ACTIFS = ['active', 'trialing', 'past_due']

// --- Recopier l'état d'un abonnement Stripe dans Supabase ------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const idClient = (client: Stripe.Subscription['customer']) => (typeof client === 'string' ? client : client.id)

// Ce qu'on recopie d'un abonnement Stripe (identique pour Solo et Équipe)
function etatAbonnement(abonnement: Stripe.Subscription) {
  // Depuis 2025, la fin de période est rangée sur chaque « ligne » de l'abonnement
  const finPeriode = abonnement.cancel_at ?? abonnement.items?.data?.[0]?.current_period_end ?? abonnement.trial_end ?? null
  return {
    p_customer: idClient(abonnement.customer),
    p_subscription: abonnement.id,
    p_statut: abonnement.status,
    p_fin: finPeriode ? new Date(finPeriode * 1000).toISOString() : null,
    p_annulation: Boolean(abonnement.cancel_at_period_end || abonnement.cancel_at),
  }
}

// À QUI appartient cet abonnement ? Une équipe (offre Équipe) ou une personne (offre Solo).
// D'abord l'étiquette posée à la création, sinon on cherche le client Stripe dans nos 2 tables.
export type Cible = { type: 'equipe' | 'solo'; id: string }

export async function cibleDeAbonnement(
  supabase: SupabaseClient, abonnement: Stripe.Subscription, secours?: { type?: string | null; id?: string | null },
): Promise<Cible | null> {
  const etiquettes = abonnement.metadata ?? {}
  if (etiquettes.type === 'solo' && UUID.test(etiquettes.user_id ?? '')) return { type: 'solo', id: etiquettes.user_id }
  if (UUID.test(etiquettes.equipe_id ?? '')) return { type: 'equipe', id: etiquettes.equipe_id }
  if (secours?.id && UUID.test(secours.id)) return { type: secours.type === 'solo' ? 'solo' : 'equipe', id: secours.id }

  const client = idClient(abonnement.customer)
  const { data: equipe } = await supabase.from('abonnements_stripe').select('equipe_id').eq('stripe_customer_id', client).maybeSingle()
  if (equipe) return { type: 'equipe', id: (equipe as { equipe_id: string }).equipe_id }
  const { data: solo } = await supabase.from('abonnements_solo').select('user_id').eq('stripe_customer_id', client).maybeSingle()
  if (solo) return { type: 'solo', id: (solo as { user_id: string }).user_id }
  return null
}

export async function appliquerAbonnement(supabase: SupabaseClient, equipeId: string, abonnement: Stripe.Subscription) {
  const { error } = await supabase.rpc('stripe_appliquer_abonnement', { p_equipe: equipeId, ...etatAbonnement(abonnement) })
  if (error) {
    logErreur('Mise à jour de la licence impossible :', error.message)
    throw new Error('Mise à jour de la licence impossible.')
  }
}

export async function appliquerAbonnementSolo(supabase: SupabaseClient, userId: string, abonnement: Stripe.Subscription) {
  const { error } = await supabase.rpc('stripe_appliquer_abonnement_solo', { p_user: userId, ...etatAbonnement(abonnement) })
  if (error) {
    logErreur('Mise à jour de l’abonnement Solo impossible :', error.message)
    throw new Error('Mise à jour de l’abonnement Solo impossible.')
  }
}

export async function appliquerSelonCible(supabase: SupabaseClient, cible: Cible, abonnement: Stripe.Subscription) {
  if (cible.type === 'solo') await appliquerAbonnementSolo(supabase, cible.id, abonnement)
  else await appliquerAbonnement(supabase, cible.id, abonnement)
}

// --- Abonnement Solo enregistré pour une personne ---------------------------------
export type LigneAbonnementSolo = Omit<LigneAbonnement, 'equipe_id'> & { user_id: string }

export async function lireAbonnementSolo(supabase: SupabaseClient, userId: string): Promise<LigneAbonnementSolo | null> {
  const { data, error } = await supabase.from('abonnements_solo').select('*').eq('user_id', userId).maybeSingle()
  if (error) {
    logErreur('Lecture de l’abonnement Solo impossible :', error.message)
    throw new Error(/does not exist|schema cache/i.test(error.message)
      ? 'Les offres ne sont pas encore installées : exécutez supabase/13_offres.sql dans Supabase.'
      : 'Lecture de l’abonnement impossible. Réessayez.')
  }
  return (data as LigneAbonnementSolo | null) ?? null
}

// Relit chez Stripe l'abonnement le plus utile d'un client (en cours d'abord, sinon le plus récent)
export async function abonnementDuClient(stripe: Stripe, customerId: string): Promise<Stripe.Subscription | null> {
  const liste = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
  const tries = [...liste.data].sort((a, b) => b.created - a.created)
  return tries.find((s) => STATUTS_ACTIFS.includes(s.status)) ?? tries[0] ?? null
}

// Traduit les erreurs Stripe les plus courantes
export function messageErreurStripe(e: unknown, contexte: string): string {
  const message = e instanceof Error ? e.message : String(e)
  logErreur(contexte, message)
  if (/Invalid API Key|api key/i.test(message)) return 'Clé Stripe invalide : vérifiez STRIPE_SECRET_KEY dans .env.local.'
  if (/No such price/i.test(message)) return 'Prix introuvable chez Stripe : vérifiez STRIPE_PRICE_SOLO / STRIPE_PRICE_EQUIPE dans .env.local (ils commencent par price_).'
  if (/configuration|portal/i.test(message)) {
    return 'L’espace client Stripe n’est pas encore activé : Stripe → Paramètres → Billing → Portail client → « Enregistrer ».'
  }
  return 'Stripe ne répond pas pour le moment. Réessayez dans un instant.'
}
