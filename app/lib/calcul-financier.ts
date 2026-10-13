// Calculs financiers d'un diagnostic, faits par le CODE (et non par l'IA, qui peut se tromper en calcul).
// Utilisé par l'écran de relecture (recalcul en direct quand le consultant modifie un chiffre)
// et par le diagnostic d'exemple. Même formule que l'API d'analyse.
import type { DiagnosticIA, Recommandation } from './diagnostic-schema'

// Nombre moyen de semaines dans un mois (52 semaines / 12 mois)
export const SEMAINES_PAR_MOIS = 4.33

const arrondi = (n: number, decimales = 0) => {
  const f = 10 ** decimales
  return Math.round(n * f) / f
}

const positif = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

// Une solution classée « ⛔ À éviter pour l'instant » n'est PAS conseillée maintenant :
// elle reste visible dans le rapport, mais ne compte ni dans le temps gagné ni dans les coûts.
export const compteDansLesGains = (r: Recommandation) => r.quadrant !== 'a_eviter'

export function calculerImpact(toutes: Recommandation[], tauxHoraire: number): DiagnosticIA['impact_financier'] {
  const recos = toutes.filter(compteDansLesGains)
  const taux = positif(tauxHoraire)
  const heures = recos.reduce((s, r) => s + (r.heures_economisees_semaine || 0), 0)
  const coutMensuel = recos.reduce((s, r) => s + positif(r.cout_mensuel_eur), 0)
  const miseEnPlace = recos.reduce((s, r) => s + positif(r.cout_mise_en_place_eur), 0)

  const impactMensuel = heures * SEMAINES_PAR_MOIS * taux
  const impactAnnuel = impactMensuel * 12
  const coutAnnuel = coutMensuel * 12
  const roiAnnuel = impactAnnuel - coutAnnuel - miseEnPlace
  const investissement = coutAnnuel + miseEnPlace
  const gainNetMensuel = impactMensuel - coutMensuel

  return {
    total_heures_economisees_semaine: arrondi(heures, 1),
    taux_horaire: taux,
    impact_mensuel: arrondi(impactMensuel),
    impact_annuel: arrondi(impactAnnuel),
    cout_outils_mensuel: arrondi(coutMensuel),
    cout_outils_annuel: arrondi(coutAnnuel),
    cout_mise_en_place: arrondi(miseEnPlace),
    roi_annuel: arrondi(roiAnnuel),
    roi_pourcentage: investissement > 0 ? arrondi((roiAnnuel / investissement) * 100) : null,
    retour_investissement_mois: gainNetMensuel > 0 ? arrondi(miseEnPlace / gainNetMensuel, 1) : null,
  }
}

export function matriceDepuis(recos: Recommandation[]): DiagnosticIA['matrice'] {
  const ids = (q: Recommandation['quadrant']) => recos.filter((r) => r.quadrant === q).map((r) => r.id)
  return {
    quick_wins: ids('quick_win'),
    projets_strategiques: ids('projet_strategique'),
    optimisations_simples: ids('optimisation_simple'),
    a_eviter: ids('a_eviter'),
  }
}

// Recalcule tout ce qui dépend des recommandations (après une modification du consultant)
export function recalculer(d: DiagnosticIA, tauxHoraire = d.impact_financier.taux_horaire): DiagnosticIA {
  return { ...d, matrice: matriceDepuis(d.recommandations), impact_financier: calculerImpact(d.recommandations, tauxHoraire) }
}
