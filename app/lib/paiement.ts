// PAIEMENT des offres Solo (29 €/mois) et Équipe (99 €/mois) avec Stripe (côté navigateur).
// Le navigateur ne voit JAMAIS la carte bancaire : le paiement se fait sur la page sécurisée de Stripe.
// Les routes serveur sont dans app/api/stripe/ et la base dans supabase/11_paiement_stripe.sql et 13_offres.sql.
import { supabase } from './supabase'

export type Abonnement = {
  statut: string | null
  fin_periode: string | null
  annulation_prevue: boolean
  stripe_customer_id: string | null
}

type Reponse<T> = { success: true; data: T } | { success: false; error: string }

// Appelle une route /api/stripe/… avec le jeton de connexion
async function appeler<T>(chemin: string, methode: 'GET' | 'POST'): Promise<{ data?: T; erreur?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { erreur: 'Votre session a expiré. Reconnectez-vous.' }
  try {
    const reponse = await fetch(chemin, { method: methode, headers: { Authorization: `Bearer ${session.access_token}` } })
    const json = (await reponse.json().catch(() => null)) as Reponse<T> | null
    if (!json) return { erreur: 'Réponse illisible du serveur.' }
    return json.success ? { data: json.data } : { erreur: json.error }
  } catch {
    return { erreur: 'Connexion impossible. Vérifiez internet et réessayez.' }
  }
}

// 💳 Ouvre la page de paiement Stripe (renvoie un message d'erreur, ou part vers Stripe)
export async function payerOffreEquipe(): Promise<string | null> {
  const { data, erreur } = await appeler<{ url: string }>('/api/stripe/abonnement', 'POST')
  if (erreur || !data) return erreur ?? 'Paiement impossible pour le moment.'
  window.location.href = data.url
  return null
}

// 🧾 Ouvre l'espace client Stripe (factures, carte, résiliation)
export async function ouvrirEspaceClient(): Promise<string | null> {
  const { data, erreur } = await appeler<{ url: string }>('/api/stripe/portail', 'POST')
  if (erreur || !data) return erreur ?? 'Ouverture impossible pour le moment.'
  window.location.href = data.url
  return null
}

// 🔄 Relit l'abonnement chez Stripe et met la licence à jour
export async function actualiserAbonnement(): Promise<{ abonnement: Abonnement | null; erreur?: string }> {
  const { data, erreur } = await appeler<{ abonnement: Abonnement | null }>('/api/stripe/abonnement', 'GET')
  return { abonnement: data?.abonnement ?? null, erreur }
}

// --- Offre SOLO (une personne) -------------------------------------------------
export async function payerOffreSolo(): Promise<string | null> {
  const { data, erreur } = await appeler<{ url: string }>('/api/stripe/solo', 'POST')
  if (erreur || !data) return erreur ?? 'Paiement impossible pour le moment.'
  window.location.href = data.url
  return null
}

export async function ouvrirEspaceClientSolo(): Promise<string | null> {
  const { data, erreur } = await appeler<{ url: string }>('/api/stripe/portail?offre=solo', 'POST')
  if (erreur || !data) return erreur ?? 'Ouverture impossible pour le moment.'
  window.location.href = data.url
  return null
}

export async function actualiserAbonnementSolo(): Promise<{ abonnement: Abonnement | null; erreur?: string }> {
  const { data, erreur } = await appeler<{ abonnement: Abonnement | null }>('/api/stripe/solo', 'GET')
  return { abonnement: data?.abonnement ?? null, erreur }
}

export async function chargerAbonnementSolo(): Promise<Abonnement | null> {
  const { data, error } = await supabase
    .from('abonnements_solo')
    .select('statut, fin_periode, annulation_prevue, stripe_customer_id')
    .maybeSingle()
  if (error) return null
  return (data as Abonnement | null) ?? null
}

// --- Offre ÉQUIPE : lecture simple (sans appeler Stripe) : null si pas d'abonnement ou si le script 11 manque
export async function chargerAbonnement(): Promise<Abonnement | null> {
  const { data, error } = await supabase
    .from('abonnements_stripe')
    .select('statut, fin_periode, annulation_prevue, stripe_customer_id')
    .maybeSingle()
  if (error) return null
  return (data as Abonnement | null) ?? null
}

const dateLongue = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

// Phrase simple pour l'Admin
export function texteAbonnement(a: Abonnement): { texte: string; ton: 'vert' | 'orange' | 'rouge' | 'gris' } {
  const date = a.fin_periode ? dateLongue(a.fin_periode) : null
  switch (a.statut) {
    case 'trialing':
      return { texte: `💳 Carte enregistrée. 1er prélèvement le ${date ?? 'à la fin de l’essai'}.`, ton: 'vert' }
    case 'active':
      return a.annulation_prevue
        ? { texte: `Résiliation prévue : l’abonnement s’arrête le ${date ?? '—'}.`, ton: 'orange' }
        : { texte: `💳 Abonnement actif. Prochain prélèvement le ${date ?? '—'}.`, ton: 'vert' }
    case 'past_due':
      return { texte: '⚠️ Le dernier paiement a échoué. Mettez à jour votre carte dans « Gérer mon abonnement ».', ton: 'rouge' }
    case 'incomplete':
      return { texte: '⏳ Paiement en cours de confirmation (validation bancaire).', ton: 'orange' }
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return { texte: 'Abonnement terminé.', ton: 'gris' }
    default:
      return { texte: 'Aucun abonnement pour le moment.', ton: 'gris' }
  }
}

// Abonnement en cours = on propose « Gérer mon abonnement » au lieu de « Payer »
export const abonnementEnCours = (a: Abonnement | null) => Boolean(a?.statut && ['active', 'trialing', 'past_due'].includes(a.statut))
