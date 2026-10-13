// API : POST /api/stripe/portail
// Ouvre l'espace client de Stripe : factures, carte bancaire, résiliation.
//   /api/stripe/portail             → abonnement de l'ÉQUIPE (Admin de l'équipe uniquement)
//   /api/stripe/portail?offre=solo  → abonnement SOLO de la personne connectée
// ⚙️ À activer une fois dans Stripe : Paramètres → Billing → Portail client → « Enregistrer ».
import {
  adminConnecte, erreur, getStripe, getSupabaseServeur, lireAbonnement, lireAbonnementSolo, messageErreurStripe,
} from '../../../lib/stripe-serveur'
import { utilisateurConnecte } from '../../../lib/supabase-serveur'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabaseServeur()
  if (!stripe || !supabase) return erreur('Le paiement n’est pas encore configuré (clés manquantes dans .env.local).', 503)

  const adresse = new URL(request.url)
  const solo = adresse.searchParams.get('offre') === 'solo'

  try {
    let customerId: string | null = null
    let retour = `${adresse.origin}/dashboard/equipe?paiement=portail`

    if (solo) {
      const moi = await utilisateurConnecte(request)
      if (!moi) return erreur('Votre session a expiré. Reconnectez-vous.', 401)
      customerId = (await lireAbonnementSolo(supabase, moi.id))?.stripe_customer_id ?? null
      retour = `${adresse.origin}/dashboard/settings?paiement=portail#mon-offre`
    } else {
      const qui = await adminConnecte(request)
      if (!qui.ok) return qui.response
      customerId = (await lireAbonnement(supabase, qui.equipe.id))?.stripe_customer_id ?? null
    }
    if (!customerId) return erreur('Aucun abonnement Stripe trouvé.', 404)

    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: retour, locale: 'fr' })
    return Response.json({ success: true, data: { url: session.url } })
  } catch (e) {
    if (e instanceof Error && /supabase\/1[13]/.test(e.message)) return erreur(e.message, 503)
    return erreur(messageErreurStripe(e, 'Ouverture de l’espace client impossible :'), 502)
  }
}
