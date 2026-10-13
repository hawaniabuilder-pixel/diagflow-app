// NOTIFICATIONS dans l'application (la cloche 🔔 du tableau de bord).
// Elles sont rangées dans la table Supabase "notifications" (fichier supabase/09_notifications.sql).
//
// Deux façons d'en créer :
//  1. Depuis le code du navigateur : await sendNotification({ type: 'succes', titre: '…' })
//  2. Automatiquement par la base (analyse terminée, rapport ouvert par le client, équipe…)
import { supabase } from './supabase'

export type TypeNotification = 'succes' | 'erreur' | 'info'

export type Notification = {
  id: string
  type: TypeNotification
  titre: string
  message: string | null
  lien: string | null
  lue: boolean
  created_at: string
}

// Couleurs et icônes de chaque type : Succès = vert, Erreur = rouge, Info = bleu
export const STYLE_NOTIFICATION: Record<TypeNotification, { icone: string; libelle: string; bord: string; pastille: string }> = {
  succes: { icone: '✅', libelle: 'Succès', bord: 'border-l-green-500', pastille: 'bg-green-500' },
  erreur: { icone: '⚠️', libelle: 'Erreur', bord: 'border-l-red-500', pastille: 'bg-red-500' },
  info: { icone: 'ℹ️', libelle: 'Info', bord: 'border-l-blue-500', pastille: 'bg-blue-500' },
}

// Prévient la cloche qu'il faut se mettre à jour tout de suite (même sans le « temps réel » de Supabase)
export const EVENEMENT_NOTIFICATION = 'diagflow-notification'
const prevenirLaCloche = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENEMENT_NOTIFICATION))
}

// Seulement une page de l'application (sécurité : pas de lien vers un autre site)
const lienInterne = (lien?: string | null) =>
  lien && lien.startsWith('/') && !lien.startsWith('//') ? lien.slice(0, 500) : null

// ---------------------------------------------------------------------
// ENVOYER une notification à la personne connectée
// Exemple :
//   await sendNotification({ type: 'succes', titre: 'Rapport envoyé', message: 'Boulangerie Dupain', lien: '/dashboard' })
// Renvoie { ok: true } ou { ok: false, erreur: '…' } (ne bloque jamais la page).
// ---------------------------------------------------------------------
export async function sendNotification({ type = 'info', titre, message = null, lien = null }: {
  type?: TypeNotification
  titre: string
  message?: string | null
  lien?: string | null
}): Promise<{ ok: boolean; erreur?: string }> {
  const titrePropre = titre.trim().slice(0, 150)
  if (!titrePropre) return { ok: false, erreur: 'Le titre est obligatoire.' }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, erreur: 'Personne n’est connecté.' }

  const { error } = await supabase.from('notifications').insert({
    user_id: session.user.id,
    type,
    titre: titrePropre,
    message: message?.trim().slice(0, 1000) || null,
    lien: lienInterne(lien),
  })
  if (error) {
    console.warn('[notifications] Envoi impossible :', error.message)
    return { ok: false, erreur: error.message }
  }
  prevenirLaCloche()
  return { ok: true }
}

// ---------------------------------------------------------------------
// LIRE : les dernières notifications + le nombre de non lues
// "indisponible" = la table n'existe pas encore (script 09 pas exécuté)
// ---------------------------------------------------------------------
export async function chargerNotifications(limite = 20): Promise<{ liste: Notification[]; nonLues: number; indisponible: boolean }> {
  const [liste, compte] = await Promise.all([
    supabase.from('notifications')
      .select('id, type, titre, message, lien, lue, created_at')
      .order('created_at', { ascending: false })
      .limit(limite),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('lue', false),
  ])
  const erreur = liste.error ?? compte.error
  if (erreur) {
    const indisponible = /notifications|relation|schema cache|does not exist/i.test(erreur.message ?? '')
    if (!indisponible) console.warn('[notifications] Lecture impossible :', erreur.message)
    return { liste: [], nonLues: 0, indisponible }
  }
  return { liste: (liste.data ?? []) as Notification[], nonLues: compte.count ?? 0, indisponible: false }
}

// ---------------------------------------------------------------------
// MARQUER comme lue / tout marquer comme lu
// ---------------------------------------------------------------------
export async function marquerCommeLue(id: string) {
  const { error } = await supabase.from('notifications').update({ lue: true }).eq('id', id)
  if (error) console.warn('[notifications] Marquage impossible :', error.message)
  return !error
}

export async function toutMarquerCommeLu() {
  const { error } = await supabase.from('notifications').update({ lue: true }).eq('lue', false)
  if (error) console.warn('[notifications] Marquage impossible :', error.message)
  return !error
}

// « à l'instant », « il y a 5 min », « il y a 3 h », « hier », « le 12/09 »
export function depuisQuand(iso: string, maintenant = Date.now()) {
  const minutes = Math.floor((maintenant - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  if (heures < 48) return 'hier'
  return `le ${new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`
}
