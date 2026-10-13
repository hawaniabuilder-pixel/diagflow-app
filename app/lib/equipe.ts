// Offre ÉQUIPE : rôles, licence, invitations.
// Toute la sécurité est dans Supabase (fichier supabase/07_equipes.sql) ;
// ce fichier sert à lire les infos et à afficher des textes clairs.
import { supabase } from './supabase'
import { ENTREPRISE, PLACES_OFFRE_EQUIPE, PRIX_OFFRE_EQUIPE } from './entreprise'

export type Role = 'admin' | 'consultant' | 'viewer'

export const ROLES: { valeur: Role; libelle: string; emoji: string; description: string; payant: boolean }[] = [
  {
    valeur: 'admin', libelle: 'Admin', emoji: '👑', payant: true,
    description: 'Gère l’équipe (invitations, rôles), crée ses diagnostics, voit et peut modifier les diagnostics partagés.',
  },
  {
    valeur: 'consultant', libelle: 'Consultant', emoji: '💼', payant: true,
    description: 'Crée ses propres diagnostics et voit ceux que l’équipe partage.',
  },
  {
    valeur: 'viewer', libelle: 'Viewer', emoji: '👁️', payant: false,
    description: 'Voit seulement les diagnostics partagés, sans rien modifier. Gratuit.',
  },
]

export const infoRole = (role: Role) => ROLES.find((r) => r.valeur === role) ?? ROLES[1]

// Offre commerciale : les prix et ton email se règlent dans lib/entreprise.ts (un seul endroit)
export { PRIX_OFFRE_EQUIPE, PLACES_OFFRE_EQUIPE, JOURS_ESSAI } from './entreprise'
// C'est à cette adresse que tes clients demandent l'activation de leur licence
export const EMAIL_VENTES = ENTREPRISE.email

export type ResumeEquipe = {
  id: string
  nom: string
  mon_role: Role
  places_max: number
  places_utilisees: number // Admin + Consultants déjà dans l'équipe
  places_reservees: number // invitations Admin/Consultant pas encore acceptées
  viewers: number
  invitations_en_attente: number
  essai_jusqu_au: string
  licence_active: boolean
  licence_jusqu_au: string | null
  active: boolean // essai en cours OU licence payée
}

export type Membre = {
  user_id: string
  email: string | null
  nom: string
  role: Role
  created_at: string
  est_moi: boolean
}

export type Invitation = {
  id: string
  email: string
  role: Role
  jeton: string
  created_at: string
  expires_at: string
}

// Le script 07 n'a pas encore été exécuté dans Supabase ?
function fonctionAbsente(message: string) {
  return /could not find the function|does not exist|schema cache/i.test(message)
}

// Mon équipe (ou null). "indisponible" = le script SQL 07 n'a pas encore été exécuté.
export async function chargerMonEquipe(): Promise<{ equipe: ResumeEquipe | null; indisponible: boolean; erreur: boolean }> {
  const { data, error } = await supabase.rpc('mon_equipe_resume')
  if (error) {
    const absente = fonctionAbsente(error.message ?? '')
    if (!absente) console.error('[equipe] Lecture impossible :', error)
    return { equipe: null, indisponible: absente, erreur: !absente }
  }
  const ligne = Array.isArray(data) ? data[0] : data
  return { equipe: (ligne as ResumeEquipe) ?? null, indisponible: false, erreur: false }
}

export async function chargerMembres(): Promise<Membre[]> {
  const { data, error } = await supabase.rpc('membres_de_mon_equipe')
  if (error) {
    console.error('[equipe] Membres illisibles :', error)
    return []
  }
  return (data ?? []) as Membre[]
}

export async function chargerInvitations(): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations_equipe')
    .select('id, email, role, jeton, created_at, expires_at')
    .is('acceptee_at', null)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[equipe] Invitations illisibles :', error)
    return []
  }
  return (data ?? []) as Invitation[]
}

// Les codes renvoyés par Supabase, traduits en phrases simples
const MESSAGES: Record<string, string> = {
  NON_CONNECTE: 'Vous devez être connecté.',
  DEJA_DANS_EQUIPE: 'Vous faites déjà partie d’une équipe. Quittez-la d’abord (page Équipe).',
  NOM_INVALIDE: 'Le nom de l’équipe doit faire entre 1 et 120 caractères.',
  PAS_ADMIN: 'Seul un Admin de l’équipe peut faire cela.',
  LICENCE_INACTIVE: 'L’essai ou la licence de l’équipe est terminé. Activez l’offre Équipe pour continuer.',
  ROLE_INVALIDE: 'Rôle inconnu.',
  EMAIL_INVALIDE: 'Adresse email invalide (ex. : prenom@cabinet.fr).',
  DEJA_MEMBRE: 'Cette personne fait déjà partie de l’équipe.',
  PLACES_EPUISEES: 'Toutes les places sont prises. Retirez quelqu’un, annulez une invitation, invitez en Viewer (gratuit) ou demandez plus de places.',
  INVITATION_INTROUVABLE: 'Invitation introuvable (elle a peut-être été annulée).',
  DEJA_ACCEPTEE: 'Cette invitation a déjà été utilisée.',
  INVITATION_EXPIREE: 'Cette invitation a expiré. Demandez-en une nouvelle.',
  MAUVAIS_EMAIL: 'Cette invitation est destinée à une autre adresse email.',
  MEMBRE_INTROUVABLE: 'Cette personne ne fait plus partie de l’équipe.',
  DERNIER_ADMIN: 'Il doit toujours rester au moins un Admin : nommez d’abord un autre Admin.',
  PAS_DANS_EQUIPE: 'Vous ne faites partie d’aucune équipe.',
  ABONNEMENT_ACTIF: 'L’équipe a un abonnement Stripe en cours : résiliez-le d’abord (Équipe → « Gérer mon abonnement »), ou invitez quelqu’un pour reprendre l’équipe.',
}

export function messageErreurEquipe(erreur: { message?: string } | null | undefined) {
  const message = erreur?.message ?? ''
  const code = Object.keys(MESSAGES).find((c) => message.includes(c))
  if (code) return MESSAGES[code]
  if (fonctionAbsente(message)) return 'La fonction Équipe n’est pas encore installée : exécutez le fichier supabase/07_equipes.sql dans Supabase.'
  return 'L’opération a échoué. Vérifiez votre connexion et réessayez.'
}

export function joursRestants(iso: string | null) {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

const dateLongue = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

// Texte + couleur de l'état de la licence
export function etatLicence(e: ResumeEquipe): { titre: string; detail: string; ton: 'vert' | 'orange' | 'rouge' } {
  const licencePayee = e.licence_active && (!e.licence_jusqu_au || new Date(e.licence_jusqu_au) > new Date())
  if (licencePayee) {
    return {
      titre: '✅ Licence Équipe active',
      detail: e.licence_jusqu_au ? `Jusqu’au ${dateLongue(e.licence_jusqu_au)}` : `${PRIX_OFFRE_EQUIPE} €/mois`,
      ton: 'vert',
    }
  }
  const jours = joursRestants(e.essai_jusqu_au)
  if (e.active && jours > 0) {
    return {
      titre: `🎁 Essai gratuit : encore ${jours} jour${jours > 1 ? 's' : ''}`,
      detail: `Jusqu’au ${dateLongue(e.essai_jusqu_au)}. Ensuite : ${PRIX_OFFRE_EQUIPE} €/mois pour ${e.places_max} places.`,
      ton: jours <= 3 ? 'orange' : 'vert',
    }
  }
  return {
    titre: '⛔ Essai terminé : le partage est en pause',
    detail: 'Vos diagnostics restent intacts. Activez l’offre Équipe pour retrouver le partage et les invitations.',
    ton: 'rouge',
  }
}

// Adresse du lien d'invitation
export const lienInvitation = (jeton: string) => `${window.location.origin}/invitation/${jeton}`

// Email d'invitation prêt à envoyer (fin = signature du consultant, voir profil.ts)
export function emailInvitation(nomEquipe: string, role: Role, email: string, lien: string, fin = '') {
  const r = infoRole(role)
  return {
    objet: `Invitation à rejoindre l’équipe « ${nomEquipe} » sur Vizion`,
    corps: `Bonjour,

Je vous invite à rejoindre l’équipe « ${nomEquipe} » sur Vizion, en tant que ${r.libelle}.
${r.emoji} ${r.description}

Pour accepter, ouvrez ce lien (valable 7 jours) :
${lien}

Important : connectez-vous (ou créez votre compte) avec cette adresse : ${email}

Bien cordialement,${fin}`,
  }
}

// Demande d'activation de la licence par email (solution de secours si le paiement Stripe n'est pas configuré)
export function lienDemandeActivation(e: ResumeEquipe) {
  const objet = `Activation de l’offre Équipe — ${e.nom}`
  const corps = `Bonjour,

Je souhaite activer l’offre Équipe (${PRIX_OFFRE_EQUIPE} €/mois pour ${PLACES_OFFRE_EQUIPE} consultants) pour mon équipe « ${e.nom} ».
Référence de l’équipe : ${e.id}

Merci !`
  return `mailto:${EMAIL_VENTES}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`
}
