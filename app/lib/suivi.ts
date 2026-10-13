// Points de SUIVI du template Premium : rendez-vous avec le client à 1, 2 et 3 mois
// après l'envoi du rapport. Le tableau de bord rappelle ceux qui sont à faire.

export type EtapeSuivi = {
  cle: 'm1' | 'm2' | 'm3'
  mois: number
  jours: number // nombre de jours après l'envoi du rapport
  colonne: 'suivi_m1_at' | 'suivi_m2_at' | 'suivi_m3_at'
  libelle: string
}

export const ETAPES_SUIVI: EtapeSuivi[] = [
  { cle: 'm1', mois: 1, jours: 30, colonne: 'suivi_m1_at', libelle: 'Point à 1 mois' },
  { cle: 'm2', mois: 2, jours: 60, colonne: 'suivi_m2_at', libelle: 'Point à 2 mois' },
  { cle: 'm3', mois: 3, jours: 90, colonne: 'suivi_m3_at', libelle: 'Point à 3 mois' },
]

export type LigneSuivi = {
  template?: string | null
  envoye_at: string | null
  suivi_m1_at?: string | null
  suivi_m2_at?: string | null
  suivi_m3_at?: string | null
}

const JOUR = 86_400_000

export const dateSuivi = (l: LigneSuivi, e: EtapeSuivi) =>
  new Date(new Date(l.envoye_at as string).getTime() + e.jours * JOUR)

// Les étapes pas encore faites (seulement pour un rapport Premium déjà envoyé)
function etapesRestantes(l: LigneSuivi) {
  if (l.template !== 'premium' || !l.envoye_at) return []
  return ETAPES_SUIVI.filter((e) => !l[e.colonne])
}

// Le point de suivi à faire MAINTENANT (le plus ancien en retard), ou null
export function suiviDu(l: LigneSuivi, maintenant = new Date()): EtapeSuivi | null {
  return etapesRestantes(l).find((e) => dateSuivi(l, e) <= maintenant) ?? null
}

// Le prochain point de suivi à venir, ou null
export function prochainSuivi(l: LigneSuivi, maintenant = new Date()): { etape: EtapeSuivi; date: Date } | null {
  const e = etapesRestantes(l).find((x) => dateSuivi(l, x) > maintenant)
  return e ? { etape: e, date: dateSuivi(l, e) } : null
}

// Email pour proposer le rendez-vous de suivi (à personnaliser librement)
export function modeleEmailSuivi(e: EtapeSuivi, entreprise: string, lien: string | null, fin = '') {
  const objet = `${entreprise} — notre point de suivi du mois ${e.mois}`
  const corps = `Bonjour,

Cela fait ${e.mois} mois que je vous ai remis le diagnostic de ${entreprise}. Comme prévu dans votre plan de suivi, je vous propose un point de 30 minutes pour faire le bilan :
- ce qui a été mis en place,
- les indicateurs du mois ${e.mois},
- les prochaines actions.
${lien ? `\nPour rappel, votre rapport : ${lien}\n` : ''}
Quelles sont vos disponibilités cette semaine ou la suivante ?

Bien cordialement,${fin}`
  return { objet, corps }
}
