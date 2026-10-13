// File d'attente de sauvegarde hors ligne.
// Quand internet est coupé (ou que Supabase ne répond pas), le brouillon est gardé
// dans la mémoire du navigateur (localStorage). Il est renvoyé dès que la connexion revient.
// ⚠️ Cette copie reste sur CET ordinateur uniquement ; elle est effacée dès que la sauvegarde réussit.

const PREFIXE = 'diagnostic-ia:attente:'

// "nouveau" = brouillon qui n'a encore jamais été enregistré dans Supabase
export type CleAttente = string | 'nouveau'

export type EnAttente<T> = {
  id: string // identifiant du brouillon (créé à l'avance, pour ne jamais faire de doublon)
  donnees: T // contenu du formulaire
  date: string // quand la copie a été faite
}

export function mettreEnAttente<T>(cle: CleAttente, element: EnAttente<T>) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(element))
    return true
  } catch {
    return false // stockage plein ou bloqué par le navigateur : on n'empêche pas le reste de marcher
  }
}

export function lireAttente<T>(cle: CleAttente): EnAttente<T> | null {
  try {
    const texte = localStorage.getItem(PREFIXE + cle)
    return texte ? (JSON.parse(texte) as EnAttente<T>) : null
  } catch {
    return null
  }
}

export function viderAttente(...cles: CleAttente[]) {
  for (const cle of cles) {
    try {
      localStorage.removeItem(PREFIXE + cle)
    } catch {
      // rien à faire
    }
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Essaie une action jusqu'à 3 fois, en attendant un peu plus longtemps entre chaque essai (1 s, puis 2 s).
// "surTentative" prévient la page du numéro de l'essai en cours (pour l'afficher).
export async function avecNouvellesTentatives<R>(
  action: () => Promise<R>,
  surTentative: (numero: number, total: number) => void,
  total = 3,
): Promise<R> {
  let derniereErreur: unknown
  for (let numero = 1; numero <= total; numero++) {
    surTentative(numero, total)
    try {
      return await action()
    } catch (e) {
      derniereErreur = e
      console.warn(`[sauvegarde] Tentative ${numero}/${total} échouée`, e)
      // Inutile d'insister si internet est coupé : la file d'attente prendra le relais
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break
      if (numero < total) await pause(1000 * 2 ** (numero - 1))
    }
  }
  throw derniereErreur
}
