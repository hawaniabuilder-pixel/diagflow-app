// Paramètres du consultant (table "profils" dans Supabase), utilisés partout :
// formulaire (taux horaire), envoi du rapport et relances (signature, Calendly),
// rapport client (logo, couleur, bouton de prise de rendez-vous).
import { supabase } from './supabase'

export type Profil = {
  nom_complet: string | null
  nom_cabinet: string | null
  logo_url: string | null
  couleur_principale: string
  lien_calendly: string | null
  signature_email: string | null
  taux_horaire_defaut: number
}

export const PROFIL_DEFAUT: Profil = {
  nom_complet: null,
  nom_cabinet: null,
  logo_url: null,
  couleur_principale: '#2563eb',
  lien_calendly: null,
  signature_email: null,
  taux_horaire_defaut: 40,
}

// Lit le profil du consultant connecté (ou les valeurs par défaut s'il n'en a pas encore)
export async function chargerProfil(): Promise<Profil> {
  const { data, error } = await supabase
    .from('profils')
    .select('nom_complet, nom_cabinet, logo_url, couleur_principale, lien_calendly, signature_email, taux_horaire_defaut')
    .maybeSingle()
  if (error) {
    // Table absente (script 04 pas encore exécuté) ou problème réseau : on continue avec les valeurs par défaut
    console.warn('[profil] Lecture impossible, valeurs par défaut utilisées :', error.message)
    return PROFIL_DEFAUT
  }
  if (!data) return PROFIL_DEFAUT
  return {
    ...PROFIL_DEFAUT,
    ...data,
    taux_horaire_defaut: data.taux_horaire_defaut == null ? 40 : Number(data.taux_horaire_defaut),
  } as Profil
}

// Couleur au format #RRGGBB (sinon couleur par défaut) — protège l'affichage
export function couleurSure(couleur: string | null | undefined) {
  return couleur && /^#[0-9a-f]{6}$/i.test(couleur) ? couleur : PROFIL_DEFAUT.couleur_principale
}

// Texte noir ou blanc selon la couleur de fond, pour rester lisible
export function couleurTexteSur(fond: string) {
  const c = couleurSure(fond)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.179 ? '#000000' : '#ffffff'
}

// Lien https uniquement (sinon rien)
export function lienHttpsSur(url: string | null | undefined) {
  return url && /^https:\/\/[^\s]+$/i.test(url) ? url : null
}

// Bloc ajouté à la fin des emails : prise de RDV + signature
export function finEmail(profil: Profil) {
  const morceaux: string[] = []
  const rdv = lienHttpsSur(profil.lien_calendly)
  if (rdv) morceaux.push(`📅 Réserver un créneau : ${rdv}`)
  const signature = profil.signature_email?.trim() || profil.nom_complet?.trim()
  if (signature) morceaux.push(signature)
  return morceaux.length ? `\n\n${morceaux.join('\n\n')}` : ''
}
