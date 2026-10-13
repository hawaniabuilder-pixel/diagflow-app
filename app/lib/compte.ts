// MES DONNÉES (RGPD) : télécharger toutes ses données, ou supprimer son compte.
import { supabase } from './supabase'

// Lit une table sans bloquer si elle n'existe pas (certains scripts SQL sont facultatifs)
async function lire(table: string, colonnes = '*', filtre?: { colonne: string; valeur: string }) {
  let requete = supabase.from(table).select(colonnes)
  if (filtre) requete = requete.eq(filtre.colonne, filtre.valeur)
  const { data, error } = await requete
  if (error) return { indisponible: error.message }
  return data ?? []
}

// Droit à la portabilité : un fichier .json avec tout ce que l'outil garde sur vous
export async function exporterMesDonnees(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const uid = session.user.id

  const donnees = {
    exporte_le: new Date().toISOString(),
    compte: { id: uid, email: session.user.email, cree_le: session.user.created_at, nom: session.user.user_metadata?.nom_complet ?? null },
    parametres: await lire('profils', '*', { colonne: 'id', valeur: uid }),
    diagnostics: await lire('diagnostics', '*', { colonne: 'user_id', valeur: uid }),
    clients: await lire('clients', '*', { colonne: 'user_id', valeur: uid }),
    notifications: await lire('notifications', '*', { colonne: 'user_id', valeur: uid }),
    utilisation_ia: await lire('utilisation_ia', 'created_at, template', { colonne: 'user_id', valeur: uid }),
  }

  const fichier = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' })
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(fichier)
  lien.download = `mes-donnees-diagnostic-ia-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000)
  return true
}

// Droit à l'effacement : supprime le logo, puis le compte et TOUTES ses données (définitif)
// Renvoie null si tout va bien, sinon un message d'erreur en français.
export async function supprimerMonCompte(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return 'Vous n’êtes plus connecté.'
  const uid = session.user.id

  // 1) Les fichiers du logo (dossier logos/<id>/)
  const { data: fichiers } = await supabase.storage.from('logos').list(uid)
  if (fichiers && fichiers.length > 0) {
    await supabase.storage.from('logos').remove(fichiers.map((f: { name: string }) => `${uid}/${f.name}`))
  }

  // 2) Le compte (et, en cascade, diagnostics, clients, paramètres, notifications…)
  const { error } = await supabase.rpc('supprimer_mon_compte')
  if (error) {
    const message = error.message ?? ''
    if (/DERNIER_ADMIN/.test(message)) return 'Vous êtes le dernier Admin de votre équipe : nommez d’abord un autre Admin (page Équipe).'
    if (/ABONNEMENT_ACTIF/.test(message)) return 'Vous avez un abonnement en cours : résiliez-le d’abord (Paramètres → Mon offre → « Gérer mon abonnement », ou page Équipe).'
    if (/could not find the function|does not exist|schema cache/i.test(message)) {
      return 'La suppression n’est pas encore installée : exécutez supabase/10_quota_et_compte.sql dans Supabase.'
    }
    console.error('[compte] Suppression impossible :', error)
    return 'La suppression a échoué. Réessayez, ou écrivez-nous.'
  }

  // 3) On vide la session du navigateur
  await supabase.auth.signOut()
  try {
    localStorage.clear()
  } catch {
    // stockage bloqué : rien à faire
  }
  return null
}
