// API : POST /api/stripe/webhook  (appelée par STRIPE, pas par le navigateur)
// Stripe prévient ici quand un abonnement (Solo ou Équipe) commence, se renouvelle, échoue ou se termine.
// 🔒 La signature « stripe-signature » prouve que le message vient bien de Stripe :
//    sans elle (ou avec une fausse), on refuse.
// Adresse à donner à Stripe (Développeurs → Webhooks) : https://VOTRE-SITE/api/stripe/webhook
import Stripe from 'stripe'
import { appliquerSelonCible, cibleDeAbonnement, erreur, getStripe, getSupabaseServeur } from '../../../lib/stripe-serveur'

export const runtime = 'nodejs'

const log = (...args: unknown[]) => console.log('[stripe/webhook]', ...args)

// Les messages qui nous intéressent (les autres sont ignorés)
const EVENEMENTS_ABONNEMENT = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
])

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabaseServeur()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !supabase || !secret) {
    console.error('[stripe/webhook] Il manque STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET ou SUPABASE_SECRET_KEY dans .env.local')
    return erreur('Webhook non configuré.', 500)
  }

  // 1) Vérifier que le message vient bien de Stripe (on lit le texte brut, sans le transformer)
  const signature = request.headers.get('stripe-signature')
  if (!signature) return erreur('Signature manquante.', 400)
  const corps = await request.text()
  let evenement: Stripe.Event
  try {
    evenement = stripe.webhooks.constructEvent(corps, signature, secret)
  } catch {
    log('⚠️ Signature invalide : message refusé.')
    return erreur('Signature invalide.', 400)
  }

  // 2) Quel abonnement est concerné ?
  let idAbonnement: string | null = null
  let secours: { type?: string | null; id?: string | null } | undefined
  if (evenement.type === 'checkout.session.completed') {
    const session = evenement.data.object as Stripe.Checkout.Session
    if (session.mode === 'subscription' && session.subscription) {
      idAbonnement = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      secours = { type: session.metadata?.type ?? null, id: session.client_reference_id }
    }
  } else if (EVENEMENTS_ABONNEMENT.has(evenement.type)) {
    idAbonnement = (evenement.data.object as Stripe.Subscription).id
  }
  if (!idAbonnement) return Response.json({ recu: true }) // message sans intérêt pour nous

  try {
    // 3) On relit l'abonnement chez Stripe : on a ainsi toujours son état le plus récent,
    //    même si les messages arrivent dans le désordre.
    const abonnement = await stripe.subscriptions.retrieve(idAbonnement)
    const cible = await cibleDeAbonnement(supabase, abonnement, secours)
    if (!cible) {
      log(`Abonnement ${abonnement.id} sans client connu : ignoré.`)
      return Response.json({ recu: true })
    }
    await appliquerSelonCible(supabase, cible, abonnement)
    log(`${evenement.type} → ${cible.type} ${cible.id} : ${abonnement.status}`)
    return Response.json({ recu: true })
  } catch (e) {
    // Réponse 500 : Stripe renverra le message plus tard (pendant plusieurs jours)
    console.error('[stripe/webhook] Traitement impossible :', e instanceof Error ? e.message : e)
    return erreur('Traitement impossible, réessayez.', 500)
  }
}
