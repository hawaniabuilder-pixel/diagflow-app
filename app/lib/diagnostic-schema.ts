// Règles de validation du formulaire de diagnostic.
// Ce fichier est utilisé à la fois par le navigateur (validation en temps réel)
// et par le serveur (app/api/diagnostic/route.ts) : les mêmes règles partout.
import { z } from 'zod'
import { TEMPLATE_IDS, TEMPLATE_PAR_DEFAUT, type TemplateId } from './templates'

// Les grands secteurs des TPE et PME françaises (proches des catégories de l'INSEE)
export const SECTEURS = [
  'Commerce',
  'Artisanat',
  'BTP',
  'Industrie',
  'Hôtellerie-restauration',
  'Santé et social',
  'Transport et logistique',
  'Services aux entreprises',
  'Services aux particuliers',
  'Tech et numérique',
  'Agriculture',
  'Immobilier',
  'Autre',
] as const

// Anciens noms de secteurs (les brouillons déjà enregistrés sont convertis à l'ouverture)
export const ANCIENS_SECTEURS: Record<string, (typeof SECTEURS)[number]> = {
  Services: 'Services aux entreprises',
  RH: 'Services aux entreprises',
  Tech: 'Tech et numérique',
}

export const OBJECTIFS = [
  { value: 'croissance', label: 'Croissance' },
  { value: 'reduction_couts', label: 'Réduction des coûts' },
  { value: 'productivite', label: 'Productivité' },
  { value: 'qualite', label: 'Qualité' },
] as const

// Les logiciels les plus courants dans les TPE et PME FRANÇAISES (à cocher s'ils sont déjà utilisés).
// Un outil absent de la liste se tape dans « Autres outils ».
export const OUTILS_PAR_CATEGORIE = [
  { categorie: 'Bureautique et stockage', outils: ['Excel', 'Microsoft 365', 'Google Workspace', 'Dropbox'] },
  { categorie: 'Communication', outils: ['WhatsApp', 'Microsoft Teams', 'Slack'] },
  { categorie: 'Comptabilité', outils: ['Pennylane', 'EBP', 'Sage', 'Cegid', 'Tiime'] },
  { categorie: 'Clients, devis et factures', outils: ['Axonaut', 'Sellsy', 'HubSpot', 'Pipedrive'] },
  { categorie: 'Banque et paiement', outils: ['Qonto', 'Shine', 'SumUp'] },
  { categorie: 'RH, planning et paie', outils: ['Skello', 'PayFit', 'Lucca', 'Silae'] },
  { categorie: 'Organisation et projets', outils: ['Trello', 'Notion', 'Monday'] },
  { categorie: 'Marketing', outils: ['Brevo', 'Mailchimp', 'Canva'] },
  { categorie: 'Vente en ligne', outils: ['Shopify', 'PrestaShop', 'WooCommerce'] },
] as const

// Anciens noms (première version de la liste) → nouveaux noms, pour les brouillons déjà enregistrés
export const ANCIENS_NOMS_OUTILS: Record<string, string> = {
  Teams: 'Microsoft Teams',
  'Sendinblue (Brevo)': 'Brevo',
}

// Les 18 régions françaises : 13 en métropole + 5 en outre-mer
export const REGIONS_METROPOLE = [
  'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est',
  'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire',
  'Provence-Alpes-Côte d’Azur',
] as const
export const REGIONS_OUTRE_MER = ['Guadeloupe', 'Martinique', 'Guyane', 'La Réunion', 'Mayotte'] as const
export const REGIONS_FRANCE: readonly string[] = [...REGIONS_METROPOLE, ...REGIONS_OUTRE_MER]

// La localisation est rangée en un seul texte : « Ville, Région » (ex. « Lyon, Auvergne-Rhône-Alpes »).
// Ces 2 petites fonctions la découpent pour le formulaire (2 champs), puis la recollent.
export function decouperLocalisation(texte: string): { ville: string; region: string } {
  for (const region of REGIONS_FRANCE) {
    if (texte === region) return { ville: '', region }
    if (texte.endsWith(`, ${region}`)) return { ville: texte.slice(0, -(region.length + 2)), region }
  }
  return { ville: texte, region: '' }
}

export function assemblerLocalisation(ville: string, region: string): string {
  if (!region) return ville
  return ville ? `${ville}, ${region}` : region
}

export const TRANSCRIPTION_MIN = 200
export const TRANSCRIPTION_MAX = 150_000
export const FICHIER_MAX_OCTETS = 10 * 1024 * 1024
export const EXTENSIONS_ACCEPTEES = ['.txt', '.docx', '.pdf']

const objectifValues = OBJECTIFS.map((o) => o.value) as [string, ...string[]]

export const diagnosticInputSchema = z.object({
  entreprise: z.string().trim()
    .min(1, 'Le nom de l’entreprise est obligatoire.')
    .max(120, '120 caractères maximum.'),
  secteur: z.enum(SECTEURS, { message: 'Choisissez un secteur d’activité.' }),
  ca: z.string().trim().max(40, '40 caractères maximum.'),
  effectif: z.number({ message: 'Indiquez le nombre de salariés.' })
    .int('Nombre entier uniquement.')
    .min(1, 'Minimum 1 salarié.')
    .max(50, 'Maximum 50 salariés.'),
  ville: z.string().trim().max(80, '80 caractères maximum.'),
  transcription: z.string().trim()
    .min(TRANSCRIPTION_MIN, `La transcription doit faire au moins ${TRANSCRIPTION_MIN} caractères.`)
    .max(TRANSCRIPTION_MAX, `La transcription est trop longue (${TRANSCRIPTION_MAX.toLocaleString('fr-FR')} caractères max).`),
  outils_existants: z.array(z.string().trim().min(1).max(60)).max(40),
  taux_horaire: z.number({ message: 'Indiquez un taux horaire.' })
    .min(0, 'Le taux ne peut pas être négatif.')
    .max(500, 'Maximum 500 €/h.'),
  objectifs: z.array(z.enum(objectifValues)).max(4),
  consentement_rgpd: z.boolean().refine((v) => v === true, 'Vous devez accepter le traitement des données.'),
})

export type DiagnosticInput = z.infer<typeof diagnosticInputSchema>

// Corps attendu par l'API : les champs du formulaire + l'id du brouillon s'il existe
// + le template de rapport (Express / Complet / Premium ; « Complet » si absent ou inconnu).
export const diagnosticRequestSchema = diagnosticInputSchema.extend({
  id: z.string().uuid().optional(),
  template: z.enum(TEMPLATE_IDS).catch(TEMPLATE_PAR_DEFAUT),
})

// ---------------------------------------------------------------------
// Forme du diagnostic produit par l'IA (utilisée pour l'affichage et les phases suivantes)
// ---------------------------------------------------------------------
export type Niveau = 'faible' | 'moyenne' | 'élevée'
export type Quadrant = 'quick_win' | 'projet_strategique' | 'optimisation_simple' | 'a_eviter'

export type PointFriction = {
  id: string
  titre: string
  description: string
  impact_heures_semaine: number
  urgence: Niveau
  categorie: 'processus' | 'outils' | 'communication' | 'rh' | 'commercial' | 'autre'
}

export type Recommandation = {
  id: string
  friction_id: string
  nom_outil: string
  categorie: string
  fonction: string
  benefice_concret: string
  cout_mensuel_eur: number
  cout_mise_en_place_eur: number
  heures_economisees_semaine: number
  complexite: Niveau
  quadrant: Quadrant
  conformite_rgpd: boolean
  alerte_rgpd: string | null
  lien_site: string
}

// --- Sections réservées au template Premium ---
export type Positionnement = 'en_avance' | 'dans_la_moyenne' | 'en_retard'

export type BenchmarkSecteur = {
  resume: string
  indicateurs: {
    indicateur: string // ex. « Délai moyen de paiement des clients »
    entreprise: string // la situation de l'entreprise (ex. « ≈ 60 jours »)
    reference_secteur: string // repère indicatif du secteur (ex. « 30 à 45 jours »)
    positionnement: Positionnement
    commentaire: string
  }[]
  bonnes_pratiques: string[] // ce que font les entreprises les plus avancées du secteur
  avertissement: string // rappel : repères indicatifs, à valider
}

export type MoisSuivi = {
  mois: number // 1, 2 ou 3
  objectif: string
  actions: string[]
  indicateurs: { nom: string; cible: string }[]
  point_de_suivi: string // ce qu'on vérifie au rendez-vous de fin de mois
}

export type DiagnosticIA = {
  template?: TemplateId // absent sur les anciens diagnostics = « Complet »
  benchmark_secteur?: BenchmarkSecteur // Premium seulement
  suivi_3_mois?: MoisSuivi[] // Premium seulement
  synthese: {
    situation: string
    probleme_principal: string
    actions_prioritaires: string[]
    accroche: string
  }
  points_friction: PointFriction[]
  recommandations: Recommandation[]
  matrice: {
    quick_wins: string[]
    projets_strategiques: string[]
    optimisations_simples: string[]
    a_eviter: string[]
  }
  plan_4_jours: {
    jour: number
    action: string
    outil_requis: string
    temps_estime_minutes: number
    responsable: string
    critere_succes: string
  }[]
  impact_financier: {
    total_heures_economisees_semaine: number
    taux_horaire: number
    impact_mensuel: number
    impact_annuel: number
    cout_outils_mensuel: number
    cout_outils_annuel: number
    cout_mise_en_place: number
    roi_annuel: number
    roi_pourcentage: number | null
    retour_investissement_mois: number | null
  }
  opportunites: {
    titre: string
    description: string
    potentiel_ca_eur: number
    delai_mise_en_oeuvre: string
    prerequis: string[]
  }[]
  alertes_rgpd: {
    nom_outil: string
    type_donnees: string[]
    vigilance_requise: string
    mesures_recommandees: string[]
  }[]
}
