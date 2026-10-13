// ⚠️ SERVEUR UNIQUEMENT : EMAILS AUTOMATIQUES envoyés avec Resend (resend.com).
// Importé seulement par les routes app/api/emails/… — jamais par une page.
//
// Réglages dans .env.local :
//   RESEND_API_KEY    clé Resend (re_…)
//   EMAIL_EXPEDITEUR  ex. « Vizion <onboarding@resend.dev> » pour tester
//                     (cette adresse d'essai n'envoie QU'À l'email de votre compte Resend)
//   SITE_URL          adresse du site en ligne (ex. https://diagflow.fr), pour les liens des emails
//   CRON_SECRET       mot de passe de la tâche quotidienne (le même dans Vercel)
import { ENTREPRISE, estACompleter, JOURS_ESSAI, PLACES_OFFRE_EQUIPE, PRIX_OFFRE_EQUIPE } from './entreprise'

const logErreur = (...args: unknown[]) => console.error('[emails]', ...args)

// Message clair si un réglage manque (null = tout est prêt)
export function emailsNonConfigures(): string | null {
  const manquants = ['RESEND_API_KEY', 'EMAIL_EXPEDITEUR', 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_SUPABASE_URL']
    .filter((nom) => !process.env[nom])
  return manquants.length ? `Emails automatiques non configurés (il manque dans .env.local : ${manquants.join(', ')}).` : null
}

// Adresse du site pour les liens (celle du réglage, sinon celle de la demande reçue)
export function adresseSite(request: Request) {
  return (process.env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, '')
}

// --- Envoi ----------------------------------------------------------------
type Email = { a: string[]; sujet: string; html: string; texte: string; cleUnique?: string }

export async function envoyerEmail(email: Email): Promise<{ ok: true; id: string } | { ok: false; erreur: string }> {
  const cle = process.env.RESEND_API_KEY
  const expediteur = process.env.EMAIL_EXPEDITEUR
  if (!cle || !expediteur) return { ok: false, erreur: 'Resend non configuré.' }

  const repondreA = estACompleter(ENTREPRISE.email) ? undefined : ENTREPRISE.email
  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
        'User-Agent': 'diagnostic-ia/1.0',
        // Même clé = Resend n'envoie pas 2 fois le même email (sécurité en plus du journal Supabase)
        ...(email.cleUnique ? { 'Idempotency-Key': email.cleUnique.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: expediteur,
        to: email.a,
        subject: email.sujet,
        html: email.html,
        text: email.texte,
        ...(repondreA ? { reply_to: repondreA } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const json = (await reponse.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!reponse.ok || !json?.id) {
      const message = json?.message ?? `HTTP ${reponse.status}`
      logErreur('Resend a refusé l’email :', message)
      return { ok: false, erreur: message }
    }
    return { ok: true, id: json.id }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logErreur('Resend injoignable :', message)
    return { ok: false, erreur: message }
  }
}

// --- Mise en page commune ---------------------------------------------------
// Protège les textes venant des utilisateurs (nom, nom d'équipe) avant de les mettre dans le HTML
export const echapper = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

type Contenu = {
  titre: string
  paragraphes: string[] // texte simple (déjà sans HTML) ; **gras** autorisé
  liste?: string[] // liste numérotée
  bouton: { texte: string; lien: string }
  apres?: string[] // paragraphes après le bouton
  pourquoi: string // pourquoi la personne reçoit cet email
}

const gras = (texte: string) => echapper(texte).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
const sansGras = (texte: string) => texte.replace(/\*\*(.+?)\*\*/g, '$1')

function miseEnPage(c: Contenu): { html: string; texte: string } {
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1f2937">${gras(t)}</p>`
  const liste = c.liste?.length
    ? `<ol style="margin:0 0 20px;padding-left:22px;font-size:16px;line-height:1.6;color:#1f2937">${c.liste.map((l) => `<li style="margin-bottom:8px">${gras(l)}</li>`).join('')}</ol>`
    : ''
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;font-family:Arial,Helvetica,sans-serif">
<tr><td>
<p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#2563eb">${echapper(ENTREPRISE.nomCommercial)}</p>
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#111827">${echapper(c.titre)}</h1>
${c.paragraphes.map(p).join('\n')}
${liste}
<p style="margin:8px 0 24px"><a href="${echapper(c.bouton.lien)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 24px;border-radius:8px">${echapper(c.bouton.texte)}</a></p>
${(c.apres ?? []).map(p).join('\n')}
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280">${echapper(c.pourquoi)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`

  const texte = [
    c.titre,
    '',
    ...c.paragraphes.map(sansGras),
    ...(c.liste ?? []).map((l, i) => `${i + 1}. ${sansGras(l)}`),
    '',
    `${c.bouton.texte} : ${c.bouton.lien}`,
    '',
    ...(c.apres ?? []).map(sansGras),
    '',
    '—',
    c.pourquoi,
  ].join('\n')
  return { html, texte }
}

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })

const repondre = () => (estACompleter(ENTREPRISE.email) ? [] : ['Une question ? Répondez simplement à cet email.'])

// --- Les modèles d'emails ---------------------------------------------------
// 1) BIENVENUE : juste après la 1re connexion
export function emailBienvenue(nom: string | null, site: string, analysesParMois: number) {
  const prenom = nom?.trim().split(/\s+/)[0]
  const contenu = miseEnPage({
    titre: `Bienvenue${prenom ? `, ${prenom}` : ''} 👋`,
    paragraphes: [
      `Votre compte ${ENTREPRISE.nomCommercial} est prêt. Voici les 3 premières choses à faire (environ 15 minutes) :`,
    ],
    liste: [
      '**Complétez votre profil** (nom, cabinet, logo) : il apparaît sur vos rapports.',
      '**Essayez le 🧪 Mode Démo** dans les Paramètres : un diagnostic complet, gratuit, sans crédit IA.',
      '**Faites votre premier vrai diagnostic** : collez la transcription d’un entretien avec un dirigeant.',
    ],
    bouton: { texte: 'Ouvrir mon tableau de bord', lien: `${site}/dashboard` },
    apres: [`Vous disposez de ${analysesParMois} analyses IA par mois.`, ...repondre()],
    pourquoi: `Vous recevez cet email car un compte ${ENTREPRISE.nomCommercial} vient d’être créé avec cette adresse.`,
  })
  return { sujet: `Bienvenue sur ${ENTREPRISE.nomCommercial} 👋`, ...contenu }
}

// 2) FIN D'ESSAI de l'offre Équipe (aux Admins) : 3 jours avant, puis le jour où il se termine
export function emailFinEssai(type: 'fin_essai_j3' | 'fin_essai_j0', nomEquipe: string, finEssai: string, site: string) {
  const date = dateLongue(finEssai)
  const lien = { lien: `${site}/dashboard/equipe`, texte: type === 'fin_essai_j3' ? 'Activer l’offre Équipe' : 'Réactiver l’offre Équipe' }
  const offre = `${PRIX_OFFRE_EQUIPE} € HT par mois pour ${PLACES_OFFRE_EQUIPE} consultants, sans engagement.`
  const pourquoi = `Vous recevez cet email car vous êtes Admin de l’équipe « ${nomEquipe} » sur ${ENTREPRISE.nomCommercial}.`

  if (type === 'fin_essai_j3') {
    const jours = Math.max(1, Math.ceil((new Date(finEssai).getTime() - Date.now()) / 86_400_000))
    return {
      sujet: `Votre essai Équipe se termine dans ${jours} jour${jours > 1 ? 's' : ''}`,
      ...miseEnPage({
        titre: `Plus que ${jours} jour${jours > 1 ? 's' : ''} d’essai gratuit`,
        paragraphes: [
          `L’essai gratuit de ${JOURS_ESSAI} jours de votre équipe « ${nomEquipe} » se termine le **${date}**.`,
          `Pour continuer à partager vos diagnostics et à inviter vos consultants, activez l’offre Équipe : ${offre}`,
          'L’activation se fait en ligne, en 1 minute, par carte bancaire (paiement sécurisé par Stripe).',
        ],
        bouton: lien,
        apres: ['Vos diagnostics restent à vous, quoi que vous décidiez.', ...repondre()],
        pourquoi,
      }),
    }
  }
  return {
    sujet: 'Votre essai Équipe est terminé',
    ...miseEnPage({
      titre: 'Votre essai gratuit est terminé',
      paragraphes: [
        `L’essai gratuit de votre équipe « ${nomEquipe} » s’est terminé le **${date}**.`,
        'Le partage des diagnostics et les invitations sont en pause. **Vos diagnostics sont intacts** : rien n’a été supprimé.',
        `Pour tout retrouver en 1 minute : ${offre}`,
      ],
      bouton: lien,
      apres: repondre(),
      pourquoi,
    }),
  }
}
