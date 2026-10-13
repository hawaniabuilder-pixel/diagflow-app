// API : POST /api/emails/bienvenue
// Envoie l'email de BIENVENUE au consultant connecté — une seule fois dans toute la vie du compte
// (le journal supabase/12_emails.sql l'empêche de partir 2 fois).
// Appelée par le tableau de bord à la 1re visite.
import { adresseSite, emailBienvenue, emailsNonConfigures, envoyerEmail } from '../../../lib/emails-serveur'
import { getSupabaseServeur, utilisateurConnecte } from '../../../lib/supabase-serveur'
import { ANALYSES_IA_INCLUSES } from '../../../lib/entreprise'

export const runtime = 'nodejs'

const ok = (data: { envoye: boolean; raison?: string }) => Response.json({ success: true, data })
const erreur = (message: string, status: number) => Response.json({ success: false, error: message }, { status })

export async function POST(request: Request) {
  // Pas encore configuré : on ne dérange pas le consultant, on le note seulement dans le terminal
  const manque = emailsNonConfigures()
  if (manque) {
    console.log('[emails]', manque)
    return ok({ envoye: false, raison: 'non_configure' })
  }

  const utilisateur = await utilisateurConnecte(request)
  if (!utilisateur) return erreur('Connectez-vous d’abord.', 401)
  if (!utilisateur.email) return ok({ envoye: false, raison: 'sans_email' })

  const supabase = getSupabaseServeur()!
  const cle = `bienvenue:${utilisateur.id}`

  // 1) Réserver l'envoi (false = déjà envoyé)
  const { data: premiereFois, error } = await supabase.rpc('reserver_email', {
    p_cle: cle, p_type: 'bienvenue', p_destinataire: utilisateur.email, p_user: utilisateur.id,
  })
  if (error) {
    console.error('[emails] Journal indisponible :', error.message)
    return erreur(/does not exist|could not find|schema cache/i.test(error.message)
      ? 'Emails non installés : exécutez supabase/12_emails.sql dans Supabase.'
      : 'Journal des emails indisponible.', 503)
  }
  if (!premiereFois) return ok({ envoye: false, raison: 'deja' })

  // 2) Envoyer (en cas d'échec, on libère la réservation pour réessayer à la prochaine visite)
  const { sujet, html, texte } = emailBienvenue(utilisateur.nom, adresseSite(request), ANALYSES_IA_INCLUSES)
  const envoi = await envoyerEmail({ a: [utilisateur.email], sujet, html, texte, cleUnique: cle })
  if (!envoi.ok) {
    await supabase.rpc('liberer_email', { p_cle: cle })
    return erreur('L’email de bienvenue n’a pas pu partir. Il sera renvoyé à la prochaine visite.', 502)
  }
  return ok({ envoye: true })
}
