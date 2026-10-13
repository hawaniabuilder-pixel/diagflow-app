// EMAILS AUTOMATIQUES (côté navigateur) : demande l'email de bienvenue une seule fois.
// L'envoi lui-même se fait sur le serveur (app/api/emails/bienvenue) avec Resend.

// Appelée par le tableau de bord. Ne bloque jamais la page, et ne montre aucune erreur :
// si l'envoi échoue, il sera retenté à la prochaine visite.
export async function demanderEmailBienvenue(userId: string, jeton: string) {
  const cle = `diagflow_bienvenue_${userId}`
  try {
    if (localStorage.getItem(cle) === 'ok') return // déjà fait depuis ce navigateur
  } catch {
    // stockage bloqué : on demande quand même (le serveur empêche les doublons)
  }
  try {
    const reponse = await fetch('/api/emails/bienvenue', { method: 'POST', headers: { Authorization: `Bearer ${jeton}` } })
    const json = (await reponse.json().catch(() => null)) as { success?: boolean; data?: { envoye: boolean; raison?: string } } | null
    // Envoyé, ou déjà envoyé avant : plus besoin de redemander depuis ce navigateur
    if (json?.success && (json.data?.envoye || json.data?.raison === 'deja')) {
      try {
        localStorage.setItem(cle, 'ok')
      } catch {
        // rien
      }
    }
  } catch {
    // pas d'internet : on réessaiera
  }
}
