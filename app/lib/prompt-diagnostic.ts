// Prompts et formats de réponse envoyés à Claude pour produire un diagnostic.
// Fichier utilisé uniquement côté serveur (par app/api/diagnostic/route.ts).
//
// Il y a 3 PROMPTS, un par template de rapport :
//   PROMPT_EXPRESS  → 1 page   : synthèse + 3 actions prioritaires
//   PROMPT_COMPLET  → 7 pages  : analyse complète + plan d'action
//   PROMPT_PREMIUM  → 15 pages : Complet + benchmark secteur + suivi 3 mois
// Les 3 partagent les mêmes règles de base (fidélité à l'entretien, estimations prudentes…).
import type Anthropic from '@anthropic-ai/sdk'
import { OBJECTIFS, type DiagnosticInput } from './diagnostic-schema'
import { TEMPLATES, type TemplateId } from './templates'

export const NOM_OUTIL_DIAGNOSTIC = 'enregistrer_diagnostic'

// ---------------------------------------------------------------------
// Blocs de texte communs
// ---------------------------------------------------------------------
const INTRO = `Tu es un consultant senior en transformation digitale, spécialiste des TPE et PME françaises (5 à 50 salariés), partout en France : métropole et outre-mer.
Ton rapport sera relu par un consultant, puis remis au DIRIGEANT de l'entreprise : il doit être crédible, concret et facile à lire pour quelqu'un qui n'est pas technicien.

MISSION : à partir de la transcription d'entretien, réalise l'analyse demandée, puis enregistre-la avec l'outil "${NOM_OUTIL_DIAGNOSTIC}".`

const REGLES_COMMUNES = `RÈGLES À RESPECTER DANS TOUS LES CAS

A. FIDÉLITÉ À L'ENTRETIEN
- Appuie chaque point de friction sur l'entretien : cite dans la description une courte phrase du dirigeant entre guillemets « … ».
- N'invente aucun fait, chiffre ou outil de l'entreprise. Si une information manque, fais une hypothèse prudente et écris-le (« À confirmer : … »).
- Tiens compte des OUTILS DÉJÀ UTILISÉS : pas de doublon, exploite d'abord l'existant (ex. mieux utiliser un outil déjà payé).

B. ESTIMATIONS RÉALISTES (le consultant engage sa crédibilité)
- Heures : reprends les durées citées dans l'entretien quand elles existent ; sinon, reste dans le bas de la fourchette.
- Pour un même point de friction, la somme des heures gagnées par ses recommandations ne dépasse JAMAIS les heures perdues de ce point.
- Au total, une PME de cette taille gagne rarement plus de 15 à 20 h/semaine avec des quick wins : ne gonfle pas les chiffres.
- Coûts : prix indicatifs HT de l'offre adaptée à la taille de l'entreprise ; en cas de doute, arrondis vers le haut. Mets un coût de mise en place si une configuration ou une formation est nécessaire.

C. RECOMMANDATIONS
- Des OUTILS RÉELS, disponibles en France, en français, avec leur URL officielle. À service équivalent, préfère les solutions françaises ou européennes.
- Priorise les outils conformes RGPD (hébergement UE, contrat de sous-traitance disponible). Si un outil traite des données personnelles, remplis "alerte_rgpd".
- "benefice_concret" : un résultat mesurable pour le dirigeant (ex. « Factures envoyées le jour même, relances automatiques à 30 jours »).
- "quadrant" : quick_win (effort faible, impact élevé), projet_strategique (effort élevé, impact élevé), optimisation_simple (effort faible, impact modéré), a_eviter (effort élevé, impact faible).

D. RÉDACTION
- En français, vouvoiement, phrases courtes, sans jargon (explique en 3 mots tout terme technique).
- "accroche" : 1 à 2 phrases qui parlent au dirigeant de SON gain concret (temps, argent, sérénité).
- Identifiants : points de friction "F1", "F2"… ; recommandations "R1", "R2"… ; chaque recommandation indique son point dans "friction_id".
- Tu n'as PAS à calculer l'impact financier global : il est calculé automatiquement à partir de tes estimations par recommandation.

E. CONTEXTE LOCAL (toute la France)
- Tiens compte de la localisation quand c'est utile : grande métropole, ville moyenne ou zone rurale, territoire d'outre-mer (décalage horaire, délais de livraison, prestataires sur place, qualité de la connexion internet).
- Si tu évoques un accompagnement public (Région, CCI, CMA, Bpifrance…), reste général et invite à vérifier auprès de l'organisme : n'invente ni nom de dispositif, ni montant, ni condition.`

const PLAN_4_JOURS = `PLAN D'ACTION SUR 4 JOURS ("plan_4_jours")
- Uniquement des quick wins, 1 à 3 actions par jour, 2 heures maximum par jour au total.
- "responsable" : un rôle cité dans l'entretien (ex. « Dirigeante », « Responsable production »).
- "critere_succes" : un résultat vérifiable (ex. « 10 factures envoyées depuis le nouvel outil »).`

const OPPORTUNITES = `OPPORTUNITÉS À 6-12 MOIS ("opportunites")
- 3 à 5 opportunités qui prolongent les quick wins et où un accompagnement par le consultant a du sens (mise en place, formation, pilotage).`

// ---------------------------------------------------------------------
// 1) PROMPT EXPRESS — 1 page, 49 €
// ---------------------------------------------------------------------
export const PROMPT_EXPRESS = `${INTRO}

FORMAT DEMANDÉ : RAPPORT EXPRESS (1 page). Il sera lu en 2 minutes par un dirigeant pressé : va droit à l'essentiel.

${REGLES_COMMUNES}

CONTENU ATTENDU — ET RIEN DE PLUS
- "synthese" : "situation" en 1 phrase, "probleme_principal" en 1 à 2 phrases, "accroche", et EXACTEMENT 3 "actions_prioritaires" (verbe à l'infinitif, 15 mots maximum chacune).
- "points_friction" : seulement les 3 points qui coûtent le plus de temps, description en 1 à 2 phrases avec une courte citation.
- "recommandations" : EXACTEMENT 3, une par action prioritaire et dans le même ordre (R1 ↔ action 1, R2 ↔ action 2, R3 ↔ action 3). Uniquement des quick wins, faciles à démarrer cette semaine.
- "alertes_rgpd" : seulement si une recommandation traite des données personnelles sensibles, sinon une liste vide.
- Pas de plan sur 4 jours, pas d'opportunités, pas de benchmark : ils sont réservés aux formats Complet et Premium.
Style télégraphique : tout doit tenir sur UNE page.`

// ---------------------------------------------------------------------
// 2) PROMPT COMPLET — 7 pages, 149 €
// ---------------------------------------------------------------------
export const PROMPT_COMPLET = `${INTRO}

FORMAT DEMANDÉ : RAPPORT COMPLET (environ 7 pages) : l'analyse complète et le plan d'action.

${REGLES_COMMUNES}

CONTENU ATTENDU
- "synthese" : situation, problème principal, accroche et exactement 3 actions prioritaires.
- "points_friction" : 5 à 8 points, description en 2 à 3 phrases avec une courte citation du dirigeant.
- "recommandations" : 1 à 2 par point de friction, adaptées au SECTEUR, à la TAILLE et aux OBJECTIFS de l'entreprise.

${PLAN_4_JOURS}

${OPPORTUNITES}`

// ---------------------------------------------------------------------
// 3) PROMPT PREMIUM — 15 pages, 299 €
// ---------------------------------------------------------------------
export const PROMPT_PREMIUM = `${INTRO}

FORMAT DEMANDÉ : RAPPORT PREMIUM (environ 15 pages) : tout le rapport Complet, plus un benchmark du secteur et un plan de suivi sur 3 mois.
C'est l'offre la plus chère : le niveau de détail et de personnalisation doit se voir, sans jamais sacrifier l'honnêteté des chiffres.

${REGLES_COMMUNES}

CONTENU ATTENDU (IDENTIQUE AU RAPPORT COMPLET)
- "synthese" : situation, problème principal, accroche et exactement 3 actions prioritaires.
- "points_friction" : 5 à 8 points, description en 2 à 3 phrases avec une courte citation du dirigeant.
- "recommandations" : 1 à 2 par point de friction, adaptées au SECTEUR, à la TAILLE et aux OBJECTIFS de l'entreprise.

${PLAN_4_JOURS}

${OPPORTUNITES}

EN PLUS : BENCHMARK SECTEUR ("benchmark_secteur")
- "resume" : 2 à 3 phrases qui situent l'entreprise par rapport aux PME comparables (même secteur, même taille et, si c'est pertinent, même type de territoire).
- "indicateurs" : 5 à 7 indicateurs utiles pour CE secteur (ex. délai de paiement des clients, part du temps passé en administratif, outils numériques utilisés, erreurs de commande, rotation des stocks…).
  Pour chacun : la situation de l'entreprise tirée de l'entretien (sinon « Non mesuré »), un repère INDICATIF pour des PME comparables, le positionnement (en_avance / dans_la_moyenne / en_retard) et un commentaire d'une phrase.
- HONNÊTETÉ OBLIGATOIRE : n'invente AUCUNE source, étude, organisme ou statistique précise. Donne des fourchettes larges et prudentes, formulées comme des repères (« souvent entre 30 et 45 jours »). Si tu n'as pas de repère fiable, écris « Repère non disponible ».
- "bonnes_pratiques" : 4 à 6 pratiques concrètes des PME les plus avancées du secteur, applicables par cette entreprise.

EN PLUS : SUIVI SUR 3 MOIS ("suivi_3_mois"), exactement 3 éléments (mois 1, 2 et 3)
- Mois 1 : déployer les quick wins. Mois 2 : ancrer les nouvelles habitudes et lancer le premier projet stratégique. Mois 3 : mesurer les résultats et préparer la suite.
- Pour chaque mois : un "objectif" mesurable, 3 à 5 "actions", 2 à 3 "indicateurs" avec une "cible" chiffrée réaliste, et le "point_de_suivi" (ce que le consultant vérifie avec le dirigeant au rendez-vous de fin de mois).`

// ---------------------------------------------------------------------
// Message envoyé avec les données de l'entreprise
// ---------------------------------------------------------------------
export function construireMessageUtilisateur(input: DiagnosticInput, template: TemplateId = 'complet') {
  const objectifs = input.objectifs
    .map((v) => OBJECTIFS.find((o) => o.value === v)?.label ?? v)
    .join(', ')
  const t = TEMPLATES[template]

  return `FORMAT DU RAPPORT : ${t.nom} (${t.pages} page${t.pages > 1 ? 's' : ''}) — ${t.slogan}.

DONNÉES DE L'ENTREPRISE :
- Nom : ${input.entreprise}
- Secteur : ${input.secteur}
- CA : ${input.ca || 'non communiqué'}
- Effectif : ${input.effectif} salariés
- Localisation : ${input.ville || 'France (non précisée)'}
- Outils actuels : ${input.outils_existants.length ? input.outils_existants.join(', ') : 'aucun indiqué'}
- Objectifs prioritaires : ${objectifs || 'non précisés'}
- Taux horaire de valorisation : ${input.taux_horaire} €/h

TRANSCRIPTION DE L'ENTRETIEN :
<transcription>
${input.transcription}
</transcription>`
}

// ---------------------------------------------------------------------
// Formats imposés aux réponses de Claude (JSON Schema).
// En "forçant" Claude à appeler l'outil, on obtient toujours un JSON valide.
// ---------------------------------------------------------------------
const niveau = { type: 'string', enum: ['faible', 'moyenne', 'élevée'] }
const texte = { type: 'string' }
const nombre = { type: 'number' }
const listeTextes = { type: 'array', items: texte }

const SYNTHESE = {
  type: 'object',
  required: ['situation', 'probleme_principal', 'actions_prioritaires', 'accroche'],
  properties: {
    situation: { type: 'string', description: 'Situation actuelle en 1 phrase.' },
    probleme_principal: { type: 'string', description: 'Problème principal identifié, 1 à 2 phrases.' },
    actions_prioritaires: { ...listeTextes, minItems: 3, maxItems: 3, description: 'Exactement 3 actions prioritaires.' },
    accroche: { type: 'string', description: 'Message d’accroche pour le dirigeant, 1 à 2 phrases.' },
  },
}

const POINTS_FRICTION = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'titre', 'description', 'impact_heures_semaine', 'urgence', 'categorie'],
    properties: {
      id: texte,
      titre: texte,
      description: { type: 'string', description: 'Avec une courte citation du dirigeant entre « ».' },
      impact_heures_semaine: nombre,
      urgence: niveau,
      categorie: { type: 'string', enum: ['processus', 'outils', 'communication', 'rh', 'commercial', 'autre'] },
    },
  },
}

const RECOMMANDATIONS = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'friction_id', 'nom_outil', 'categorie', 'fonction', 'benefice_concret', 'cout_mensuel_eur',
      'cout_mise_en_place_eur', 'heures_economisees_semaine', 'complexite', 'quadrant', 'conformite_rgpd',
      'alerte_rgpd', 'lien_site'],
    properties: {
      id: texte,
      friction_id: texte,
      nom_outil: texte,
      categorie: texte,
      fonction: { type: 'string', description: '1 phrase claire.' },
      benefice_concret: { type: 'string', description: 'Ex : "Gain de 5h/semaine sur la facturation".' },
      cout_mensuel_eur: { type: 'number', description: 'Coût mensuel HT pour l’entreprise, en euros.' },
      cout_mise_en_place_eur: { type: 'number', description: 'Coût ponctuel de mise en place HT (0 si aucun).' },
      heures_economisees_semaine: nombre,
      complexite: niveau,
      quadrant: { type: 'string', enum: ['quick_win', 'projet_strategique', 'optimisation_simple', 'a_eviter'] },
      conformite_rgpd: { type: 'boolean' },
      alerte_rgpd: { type: ['string', 'null'] },
      lien_site: { type: 'string', description: 'URL officielle de l’outil.' },
    },
  },
}

const PLAN = {
  type: 'array',
  items: {
    type: 'object',
    required: ['jour', 'action', 'outil_requis', 'temps_estime_minutes', 'responsable', 'critere_succes'],
    properties: {
      jour: { type: 'integer', enum: [1, 2, 3, 4] },
      action: texte,
      outil_requis: texte,
      temps_estime_minutes: nombre,
      responsable: texte,
      critere_succes: texte,
    },
  },
}

const OPPORTUNITES_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: ['titre', 'description', 'potentiel_ca_eur', 'delai_mise_en_oeuvre', 'prerequis'],
    properties: {
      titre: texte,
      description: texte,
      potentiel_ca_eur: nombre,
      delai_mise_en_oeuvre: { type: 'string', description: 'Ex : "6-9 mois".' },
      prerequis: listeTextes,
    },
  },
}

const ALERTES_RGPD = {
  type: 'array',
  items: {
    type: 'object',
    required: ['nom_outil', 'type_donnees', 'vigilance_requise', 'mesures_recommandees'],
    properties: {
      nom_outil: texte,
      type_donnees: listeTextes,
      vigilance_requise: texte,
      mesures_recommandees: listeTextes,
    },
  },
}

const BENCHMARK = {
  type: 'object',
  required: ['resume', 'indicateurs', 'bonnes_pratiques'],
  properties: {
    resume: { type: 'string', description: '2 à 3 phrases.' },
    indicateurs: {
      type: 'array',
      minItems: 5,
      maxItems: 7,
      items: {
        type: 'object',
        required: ['indicateur', 'entreprise', 'reference_secteur', 'positionnement', 'commentaire'],
        properties: {
          indicateur: texte,
          entreprise: { type: 'string', description: 'Situation de l’entreprise tirée de l’entretien, ou « Non mesuré ».' },
          reference_secteur: { type: 'string', description: 'Repère INDICATIF en fourchette prudente, ou « Repère non disponible ». Aucune source inventée.' },
          positionnement: { type: 'string', enum: ['en_avance', 'dans_la_moyenne', 'en_retard'] },
          commentaire: { type: 'string', description: '1 phrase.' },
        },
      },
    },
    bonnes_pratiques: { ...listeTextes, minItems: 4, maxItems: 6 },
  },
}

const SUIVI_3_MOIS = {
  type: 'array',
  minItems: 3,
  maxItems: 3,
  items: {
    type: 'object',
    required: ['mois', 'objectif', 'actions', 'indicateurs', 'point_de_suivi'],
    properties: {
      mois: { type: 'integer', enum: [1, 2, 3] },
      objectif: { type: 'string', description: 'Objectif mesurable du mois.' },
      actions: { ...listeTextes, minItems: 3, maxItems: 5 },
      indicateurs: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['nom', 'cible'],
          properties: { nom: texte, cible: { type: 'string', description: 'Cible chiffrée réaliste.' } },
        },
      },
      point_de_suivi: { type: 'string', description: 'Ce que le consultant vérifie au rendez-vous de fin de mois.' },
    },
  },
}

function outil(proprietes: Record<string, unknown>, requis: string[], description: string): Anthropic.Tool {
  return {
    name: NOM_OUTIL_DIAGNOSTIC,
    description,
    input_schema: { type: 'object', required: requis, properties: proprietes },
  }
}

// Express : pas de plan 4 jours, pas d'opportunités (ils ne sont même pas proposés à l'IA)
export const OUTIL_EXPRESS = outil(
  {
    synthese: SYNTHESE,
    points_friction: { ...POINTS_FRICTION, maxItems: 3 },
    recommandations: { ...RECOMMANDATIONS, minItems: 3, maxItems: 3 },
    alertes_rgpd: ALERTES_RGPD,
  },
  ['synthese', 'points_friction', 'recommandations', 'alertes_rgpd'],
  'Enregistre le diagnostic EXPRESS (1 page) de la PME.',
)

const PROPRIETES_COMPLET = {
  synthese: SYNTHESE,
  points_friction: POINTS_FRICTION,
  recommandations: RECOMMANDATIONS,
  plan_4_jours: PLAN,
  opportunites: OPPORTUNITES_SCHEMA,
  alertes_rgpd: ALERTES_RGPD,
}
const REQUIS_COMPLET = ['synthese', 'points_friction', 'recommandations', 'plan_4_jours', 'opportunites', 'alertes_rgpd']

export const OUTIL_COMPLET = outil(PROPRIETES_COMPLET, REQUIS_COMPLET, 'Enregistre le diagnostic COMPLET de la PME.')

export const OUTIL_PREMIUM = outil(
  { ...PROPRIETES_COMPLET, benchmark_secteur: BENCHMARK, suivi_3_mois: SUIVI_3_MOIS },
  [...REQUIS_COMPLET, 'benchmark_secteur', 'suivi_3_mois'],
  'Enregistre le diagnostic PREMIUM de la PME (complet + benchmark secteur + suivi 3 mois).',
)

// ---------------------------------------------------------------------
// Ce que la route API utilise : le bon prompt, le bon format et la bonne longueur maximale
// ---------------------------------------------------------------------
export type ConfigurationTemplate = {
  system: string
  outil: Anthropic.Tool
  maxTokens: number // longueur maximale de la réponse (trop court = réponse coupée)
  temperature: number
}

export function configurationTemplate(template: TemplateId): ConfigurationTemplate {
  switch (template) {
    case 'express':
      return { system: PROMPT_EXPRESS, outil: OUTIL_EXPRESS, maxTokens: 4000, temperature: 0.6 }
    case 'premium':
      // Plus long (benchmark + suivi) et un peu moins « créatif » : on veut des repères prudents
      return { system: PROMPT_PREMIUM, outil: OUTIL_PREMIUM, maxTokens: 16000, temperature: 0.5 }
    default:
      return { system: PROMPT_COMPLET, outil: OUTIL_COMPLET, maxTokens: 12000, temperature: 0.7 }
  }
}

// Anciens noms, gardés pour compatibilité (= template Complet)
export const SYSTEM_PROMPT = PROMPT_COMPLET
export const OUTIL_DIAGNOSTIC = OUTIL_COMPLET
