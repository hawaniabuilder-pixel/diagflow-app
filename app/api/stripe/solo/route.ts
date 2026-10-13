// API : /api/stripe/solo  (toute personne connectée)
//   POST → prépare la page de paiement Stripe de l'offre SOLO (29 €/mois) et renvoie son adresse
//   GET  → relit l'abonnement Solo chez Stripe et le recopie dans Supabase (au retour du paiement,
//          ou avec le bouton « 🔄 Actualiser »). Utile même si le webhook n'est pas encore branché.
import {
  abonnementDuClient, appliquerAbonnementSolo, configurationManquante, erreur, getStripe, getSupabaseServeur,
  lireAbonnementSolo, messageErreurStripe, STATUTS_ACTIFS,
} from '../../../lib/stripe-serveur'
import { utilisateurConnecte } from '../../../lib/supabase-serveur'

export const runtime = 'nodejs'

const erreurInstallation = (e: unknown) => e instanceof Error && /supabase\/1[13]/.test(e.message)

export async function POST(request: Request) {
  const manque = configurationManquante('STRIPE_PRICE_SOLO')
  if (manque) return erreur(manque, 503)
  const stripe = getStripe()!
  const supabase = getSupabaseServeur()!

  const moi = await utilisateurConnecte(request)
  if (!moi) return erreur('Votre session a expiré. Reconnectez-vous.', 401)

  try {
    // 1) A-t-il déjà une offre payante ?
    const { data: offre, error: erreurOffre } = await supabase.rpc('offre_de', { p_user: moi.id })
    if (erreurOffre) throw new Error('Les offres ne sont pas encore installées : exécutez supabase/13_offres.sql dans Supabase.')
    if (offre === 'equipe') return erreur('Vous profitez déjà de l’offre Équipe : pas besoin de l’offre Solo.', 409)
    if (offre === 'solo') return erreur('Vous avez déjà l’offre Solo : utilisez « Gérer mon abonnement ».', 409)
    if (offre === 'sur_mesure') return erreur('Vous avez une offre sur mesure : contactez-nous pour la modifier.', 409)

    const actuel = await lireAbonnementSolo(supabase, moi.id)
    if (actuel?.statut && STATUTS_ACTIFS.includes(actuel.statut)) {
      return erreur('Vous avez déjà un abonnement en cours : utilisez « Gérer mon abonnement ».', 409)
    }

    // 2) Le client Stripe de la personne (créé la 1re fois, puis retenu)
    let customerId = actuel?.stripe_customer_id ?? null
    if (customerId) {
      const existant = await stripe.customers.retrieve(customerId).catch(() => null)
      if (!existant || ('deleted' in existant && existant.deleted)) customerId = null
    }
    if (!customerId) {
      const client = await stripe.customers.create({
        email: moi.email ?? undefined,
        name: moi.nom ?? undefined,
        metadata: { type: 'solo', user_id: moi.id },
      })
      customerId = client.id
      const { error } = await supabase.rpc('stripe_enregistrer_client_solo', { p_user: moi.id, p_customer: customerId })
      if (error) throw new Error(`Enregistrement du client impossible : ${error.message}`)
    }

    // 3) La page de paiement sécurisée de Stripe
    const origine = new URL(request.url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: moi.id,
      line_items: [{ price: process.env.STRIPE_PRICE_SOLO!, quantity: 1 }],
      subscription_data: { metadata: { type: 'solo', user_id: moi.id } },
      metadata: { type: 'solo', user_id: moi.id },
      locale: 'fr',
      allow_promotion_codes: true, // pour le « prix fondateur » des premiers clients (code créé dans Stripe)
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
      success_url: `${origine}/dashboard/settings?paiement=reussi#mon-offre`,
      cancel_url: `${origine}/dashboard/settings?paiement=annule#mon-offre`,
    })
    if (!session.url) throw new Error('Stripe n’a pas renvoyé d’adresse de paiement.')
    return Response.json({ success: true, data: { url: session.url } })
  } catch (e) {
    if (erreurInstallation(e)) return erreur((e as Error).message, 503)
    return erreur(messageErreurStripe(e, 'Création du paiement Solo impossible :'), 502)
  }
}

export async function GET(request: Request) {
  const manque = configurationManquante('STRIPE_PRICE_SOLO')
  if (manque) return erreur(manque, 503)
  const stripe = getStripe()!
  const supabase = getSupabaseServeur()!

  const moi = await utilisateurConnecte(request)
  if (!moi) return erreur('Votre session a expiré. Reconnectez-vous.', 401)

  try {
    const actuel = await lireAbonnementSolo(supabase, moi.id)
    if (!actuel?.stripe_customer_id) return Response.json({ success: true, data: { abonnement: null } })
    const abonnement = await abonnementDuClient(stripe, actuel.stripe_customer_id)
    if (abonnement) await appliquerAbonnementSolo(supabase, moi.id, abonnement)
    return Response.json({ success: true, data: { abonnement: await lireAbonnementSolo(supabase, moi.id) } })
  } catch (e) {
    if (erreurInstallation(e)) return erreur((e as Error).message, 503)
    return erreur(messageErreurStripe(e, 'Actualisation de l’offre Solo impossible :'), 502)
  }
}
