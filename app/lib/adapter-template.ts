// Met un diagnostic « à la forme » de son template (Express / Complet / Premium),
// et vérifie la cohérence des heures gagnées. Utilisé par l'API et par le mode démo.
import type { DiagnosticIA } from './diagnostic-schema'
import type { TemplateId } from './templates'
import { compteDansLesGains, recalculer } from './calcul-financier'

// Affiché sous le benchmark Premium : on reste honnête sur l'origine des repères
export const AVERTISSEMENT_BENCHMARK =
  'Repères indicatifs établis à partir de l’entretien et des pratiques courantes du secteur, sans étude statistique : à confirmer avec vos propres données.'

// Pour chaque point de friction, les heures gagnées par ses solutions ne peuvent pas dépasser
// les heures perdues (sinon on promettrait de gagner plus de temps qu'on n'en perd).
// Les solutions « à éviter pour l'instant » ne comptent pas (elles ne sont pas conseillées maintenant).
// Si c'est le cas, on réduit les heures de ces solutions dans la même proportion (arrondi à la demi-heure inférieure).
export function plafonnerHeuresParFriction(d: DiagnosticIA): DiagnosticIA {
  const recommandations = d.recommandations.map((r) => ({ ...r }))
  for (const f of d.points_friction) {
    const perdues = Number(f.impact_heures_semaine)
    if (!(perdues > 0)) continue
    const liees = recommandations.filter((r) => r.friction_id === f.id && compteDansLesGains(r))
    const gagnees = liees.reduce((s, r) => s + Math.max(0, Number(r.heures_economisees_semaine) || 0), 0)
    if (gagnees <= perdues) continue
    const ratio = perdues / gagnees
    for (const r of liees) {
      r.heures_economisees_semaine = Math.floor(Math.max(0, r.heures_economisees_semaine) * ratio * 2) / 2
    }
  }
  return { ...d, recommandations }
}

// Garde seulement ce qui appartient au template, puis recalcule les montants
export function adapterAuTemplate(d: DiagnosticIA, template: TemplateId): DiagnosticIA {
  const { benchmark_secteur, suivi_3_mois, ...base } = d
  const commun: DiagnosticIA = {
    ...base,
    template,
    synthese: { ...d.synthese, actions_prioritaires: d.synthese.actions_prioritaires.slice(0, 3) },
  }

  if (template === 'express') {
    return recalculer({
      ...commun,
      points_friction: d.points_friction.slice(0, 3),
      recommandations: d.recommandations.filter(compteDansLesGains).slice(0, 3), // jamais une solution « à éviter »
      plan_4_jours: [],
      opportunites: [],
    })
  }

  if (template === 'premium') {
    return recalculer({
      ...commun,
      benchmark_secteur: benchmark_secteur
        ? { ...benchmark_secteur, avertissement: AVERTISSEMENT_BENCHMARK }
        : undefined,
      suivi_3_mois: suivi_3_mois
        ? [...suivi_3_mois].sort((a, b) => a.mois - b.mois).slice(0, 3)
        : undefined,
    })
  }

  return recalculer(commun) // Complet
}
