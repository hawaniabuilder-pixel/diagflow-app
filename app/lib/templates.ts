// Les 3 TEMPLATES de rapport (formats vendus au client).
// Ce fichier ne contient que des données : il est utilisé par le navigateur ET par l'API.
//   Express  : 1 page,  49 €  → synthèse + 3 actions prioritaires
//   Complet  : 7 pages, 149 € → analyse complète + plan d'action
//   Premium  : 15 pages, 299 € → Complet + benchmark secteur + suivi 3 mois

export const TEMPLATE_IDS = ['express', 'complet', 'premium'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

export const TEMPLATE_PAR_DEFAUT: TemplateId = 'complet'

export type Template = {
  id: TemplateId
  nom: string
  emoji: string
  pages: number
  prix: number // prix conseillé, en euros HT
  slogan: string
  pourQui: string
  contenu: string[] // ce que contient le rapport (affiché sur la carte)
  planDesPages: string[] // aperçu page par page
  recommande?: boolean
}

export const TEMPLATES: Record<TemplateId, Template> = {
  express: {
    id: 'express',
    nom: 'Express',
    emoji: '⚡',
    pages: 1,
    prix: 49,
    slogan: 'L’essentiel en 1 page',
    pourQui: 'Premier contact, petit budget, dirigeant pressé',
    contenu: ['Synthèse de la situation', 'Chiffres clés (temps et argent gagnés)', '3 actions prioritaires'],
    planDesPages: ['Page 1 : synthèse, chiffres clés et les 3 actions prioritaires'],
  },
  complet: {
    id: 'complet',
    nom: 'Complet',
    emoji: '📘',
    pages: 7,
    prix: 149,
    slogan: 'L’analyse complète + le plan d’action',
    pourQui: 'La majorité des missions d’accompagnement',
    contenu: [
      'Tout l’Express',
      '5 à 8 points de friction détaillés',
      'Matrice effort / impact',
      'Outils recommandés (coûts, RGPD)',
      'Plan d’action sur 4 jours',
      'Opportunités à 6-12 mois',
    ],
    planDesPages: [
      'Page 1 : synthèse et chiffres clés',
      'Page 2 : ce qui fait perdre du temps',
      'Page 3 : matrice effort / impact',
      'Pages 4-5 : solutions recommandées',
      'Page 6 : plan d’action sur 4 jours',
      'Page 7 : opportunités et points RGPD',
    ],
    recommande: true,
  },
  premium: {
    id: 'premium',
    nom: 'Premium',
    emoji: '💎',
    pages: 15,
    prix: 299,
    slogan: 'Complet + benchmark secteur + suivi 3 mois',
    pourQui: 'Clients engagés, accompagnement sur la durée',
    contenu: [
      'Tout le Complet',
      'Benchmark : comparaison avec le secteur',
      'Pratiques des entreprises les plus avancées',
      'Plan de suivi sur 3 mois (objectifs, indicateurs)',
      'Rendez-vous de suivi à 1, 2 et 3 mois',
    ],
    planDesPages: [
      'Pages 1-7 : tout le rapport Complet',
      'Pages 8-10 : benchmark secteur et bonnes pratiques',
      'Pages 11-13 : suivi mois 1, mois 2, mois 3',
      'Page 14 : indicateurs de réussite',
      'Page 15 : prochaines étapes et rendez-vous',
    ],
  },
}

export const LISTE_TEMPLATES: Template[] = TEMPLATE_IDS.map((id) => TEMPLATES[id])

// Protège contre une valeur inconnue (ancienne donnée, faute de frappe…)
export function templateSur(valeur: unknown): TemplateId {
  return typeof valeur === 'string' && (TEMPLATE_IDS as readonly string[]).includes(valeur)
    ? (valeur as TemplateId)
    : TEMPLATE_PAR_DEFAUT
}

export const prixTemplate = (id: TemplateId) => TEMPLATES[id].prix
