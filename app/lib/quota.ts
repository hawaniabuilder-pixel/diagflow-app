// Compteur d'analyses IA (fichiers supabase/10_quota_et_compte.sql puis 13_offres.sql).
//   essai      : 3 analyses offertes au total (pas de remise à zéro)
//   solo       : 30 par mois (offre Solo, 29 €/mois)
//   equipe     : 30 par mois et par consultant (offre Équipe, licence payée ;
//                pendant l'essai gratuit de l'équipe, chacun reste en « essai »)
//   sur_mesure : quota choisi à la main par l'éditeur
import { supabase } from './supabase'

export type Offre = 'essai' | 'solo' | 'equipe' | 'sur_mesure'

export type UtilisationIA = {
  offre?: Offre // absent tant que supabase/13_offres.sql n'est pas installé
  utilisees: number
  quota: number
  restantes: number
  renouvellement: string | null // prochaine remise à zéro (le 1er du mois) ; null pour l'essai
}

export const NOMS_OFFRES: Record<Offre, string> = {
  essai: '🎁 Essai gratuit',
  solo: '💼 Offre Solo',
  equipe: '👥 Offre Équipe',
  sur_mesure: '⭐ Offre sur mesure',
}

// null = le script 10 n'est pas encore installé (ou problème réseau)
export async function chargerUtilisationIA(): Promise<UtilisationIA | null> {
  const { data, error } = await supabase.rpc('mon_utilisation_ia')
  if (error) {
    if (!/could not find the function|does not exist|schema cache/i.test(error.message ?? '')) {
      console.warn('[quota] Lecture impossible :', error.message)
    }
    return null
  }
  const ligne = Array.isArray(data) ? data[0] : data
  return (ligne as UtilisationIA) ?? null
}

export const dateRenouvellement = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''
