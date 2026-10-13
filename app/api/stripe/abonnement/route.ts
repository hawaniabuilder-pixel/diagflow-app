// API : /api/stripe/abonnement  (Admin de l'équipe uniquement)
//   POST → prépare la page de paiement Stripe de l'offre Équipe et renvoie son adresse
//   GET  → relit l'abonnement chez Stripe et met la licence à jour (au retour du paiement,
//          ou avec le bouton « 🔄 Actualiser »). Utile même si le webhook n'est pas encore branché.
import {
  abonnementDuClient, adminConnecte, appliquerAbonnement, configurationManquante, erreur, getStripe,
  getSupabaseServeur, lireAbonnement, messageErreurStripe, STATUTS_ACTIFS,
} from '../../../lib/stripe-serveur'

export const runtime = 'nodejs'

const DEUX_JOURS_ET_UNE_HEURE = (48 + 1) * 3600 // Stripe exige au moins 48 h pour un essai

export async function POST(request: Request) {
  const manque = configurationManquante()
  if (manque) return erreur(manque, 503)
  const stripe = getStripe()!
  const supabase = getSupabaseServeur()!

  const qui = await adminConnecte(request)
  if (!qui.ok) return qui.response
  const { equipe, email } = qui

  try {
    // 1) Déjà abonné ? On renvoie vers « Gérer mon abonnement » plutôt que de payer 2 fois
    const actuel = await lireAbonnement(supabase, equipe.id)
    if (actuel?.statut && STATUTS_ACTIFS.includes(actuel.statut)) {
      return erreur('Votre équipe a déjà un abonnement en cours : utilisez « Gérer mon abonnement ».', 409)
    }

    // 2) Le client Stripe de l'équipe (on le crée la 1re fois, et on le retient)
    let customerId = actuel?.stripe_customer_id ?? null
    if (customerId) {
      // Il peut avoir été supprimé chez Stripe, ou venir du mode test : on vérifie
      const existant = await stripe.customers.retrieve(customerId).catch(() => null)
      if (!existant || ('deleted' in existant && existant.deleted)) customerId = null
    }
    if (!customerId) {
      const client = await stripe.customers.create({
        email: email ?? undefined,
        name: equipe.nom,
        metadata: { equipe_id: equipe.id },
      })
      customerId = client.id
      const { error } = await supabase.rpc('stripe_enregistrer_client', { p_equipe: equipe.id, p_customer: customerId })
      if (error) throw new Error(`Enregistrement du client impossible : ${error.message}`)
    }

    // 3) Essai gratuit encore en cours ? Le 1er prélèvement aura lieu à la fin de l'essai
    const finEssai = Math.floor(new Date(equipe.essai_jusqu_au).getTime() / 1000)
    const garderEssai = finEssai - Math.floor(Date.now() / 1000) > DEUX_JOURS_ET_UNE_HEURE

    // 4) La page de paiement sécurisée de Stripe
    const origine = new URL(request.url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: equipe.id,
      line_items: [{ price: process.env.STRIPE_PRICE_EQUIPE!, quantity: 1 }],
      subscription_data: {
        metadata: { equipe_id: equipe.id },
        ...(garderEssai ? { trial_end: finEssai } : {}),
      },
      metadata: { equipe_id: equipe.id },
      locale: 'fr',
      allow_promotion_codes: true,
      billing_address_collection: 'required', // adresse sur la facture
      tax_id_collection: { enabled: true }, // n° de TVA de l'entreprise (facultatif pour le client)
      customer_update: { name: 'auto', address: 'auto' },
      success_url: `${origine}/dashboard/equipe?paiement=reussi`,
      cancel_url: `${origine}/dashboard/equipe?paiement=annule`,
    })
    if (!session.url) throw new Error('Stripe n’a pas renvoyé d’adresse de paiement.')
    return Response.json({ success: true, data: { url: session.url } })
  } catch (e) {
    if (e instanceof Error && /supabase\/1[13]/.test(e.message)) return erreur(e.message, 503)
    return erreur(messageErreurStripe(e, 'Création du paiement impossible :'), 502)
  }
}

export async function GET(request: Request) {
  const manque = configurationManquante()
  if (manque) return erreur(manque, 503)
  const stripe = getStripe()!
  const supabase = getSupabaseServeur()!

  const qui = await adminConnecte(request)
  if (!qui.ok) return qui.response

  try {
    const actuel = await lireAbonnement(supabase, qui.equipe.id)
    if (!actuel?.stripe_customer_id) return Response.json({ success: true, data: { abonnement: null } })

    const abonnement = await abonnementDuClient(stripe, actuel.stripe_customer_id)
    if (abonnement) await appliquerAbonnement(supabase, qui.equipe.id, abonnement)
    const apres = await lireAbonnement(supabase, qui.equipe.id)
    return Response.json({ success: true, data: { abonnement: apres } })
  } catch (e) {
    if (e instanceof Error && /supabase\/1[13]/.test(e.message)) return erreur(e.message, 503)
    return erreur(messageErreurStripe(e, 'Actualisation impossible :'), 502)
  }
}
