// API : GET /api/emails/quotidien — la TÂCHE AUTOMATIQUE de chaque matin.
// En ligne, Vercel l'appelle tout seul chaque jour (fichier vercel.json).
// Elle envoie les emails de FIN D'ESSAI de l'offre Équipe (3 jours avant, puis le jour J),
// chacun une seule fois (journal supabase/12_emails.sql).
//
// 🔒 Protégée par un mot de passe : l'en-tête « Authorization: Bearer <CRON_SECRET> ».
//    Vercel l'ajoute automatiquement quand la variable CRON_SECRET existe.
// Pour tester sur votre ordinateur (PowerShell), remplacez VOTRE_SECRET :
//    curl.exe -H "Authorization: Bearer VOTRE_SECRET" http://localhost:3000/api/emails/quotidien
import { adresseSite, emailFinEssai, emailsNonConfigures, envoyerEmail } from '../../../lib/emails-serveur'
import { getSupabaseServeur } from '../../../lib/supabase-serveur'

export const runtime = 'nodejs'
export const maxDuration = 60

type EquipeAPrevenir = {
  equipe_id: string
  nom: string
  essai_jusqu_au: string
  type: 'fin_essai_j3' | 'fin_essai_j0'
  emails_admins: string[] | null
}

const erreur = (message: string, status: number) => Response.json({ success: false, error: message }, { status })
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Compare 2 textes sans laisser deviner le mot de passe par le temps de réponse
function memeTexte(a: string, b: string) {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return erreur('CRON_SECRET manquant (ou trop court : 16 caractères minimum) dans .env.local.', 500)
  const recu = request.headers.get('authorization') ?? ''
  if (!memeTexte(recu, `Bearer ${secret}`)) return erreur('Accès refusé.', 401)

  const manque = emailsNonConfigures()
  if (manque) return erreur(manque, 503)
  const supabase = getSupabaseServeur()!
  const site = adresseSite(request)

  const { data, error } = await supabase.rpc('equipes_fin_essai')
  if (error) {
    console.error('[emails/quotidien] Lecture impossible :', error.message)
    return erreur('Lecture des équipes impossible (supabase/12_emails.sql est-il installé ?).', 503)
  }

  const bilan = { envoyes: 0, deja: 0, erreurs: 0 }
  for (const equipe of (data ?? []) as EquipeAPrevenir[]) {
    const destinataires = (equipe.emails_admins ?? []).filter(Boolean)
    if (destinataires.length === 0) continue
    const cle = `${equipe.type}:${equipe.equipe_id}`

    const { data: premiereFois, error: erreurReservation } = await supabase.rpc('reserver_email', {
      p_cle: cle, p_type: equipe.type, p_destinataire: destinataires.join(', '), p_equipe: equipe.equipe_id,
    })
    if (erreurReservation) {
      bilan.erreurs++
      continue
    }
    if (!premiereFois) {
      bilan.deja++
      continue
    }

    const { sujet, html, texte } = emailFinEssai(equipe.type, equipe.nom, equipe.essai_jusqu_au, site)
    const envoi = await envoyerEmail({ a: destinataires, sujet, html, texte, cleUnique: cle })
    if (envoi.ok) {
      bilan.envoyes++
    } else {
      bilan.erreurs++
      await supabase.rpc('liberer_email', { p_cle: cle }) // on réessaiera demain
    }
    await pause(600) // Resend accepte quelques emails par seconde : on ne se presse pas
  }

  console.log('[emails/quotidien]', bilan)
  return Response.json({ success: true, data: bilan })
}
