// DONNÉES DE DÉMO : tester l'outil sans utiliser l'IA (donc sans crédit Anthropic).
// ⚠️ Tout est FICTIF : entreprise, outils, prix et estimations servent uniquement aux tests et aux démonstrations.
//
// Contenu :
//  - TRANSCRIPTION_DEMO / FORMULAIRE_DEMO : l'entreprise fictive et son entretien (pré-remplis en mode démo)
//  - diagnosticDemo()   : un diagnostic complet, calculé comme le vrai (mêmes formules financières)
//  - reponseIASimulee() : ce que « répond l'IA » en mode démo, adapté au nom et au taux horaire saisis
//                         (avec vitrine: true → version « propre » pour la page publique /exemple)
//  - ETAPES_SIMULATION  : la fausse progression affichée pendant l'analyse simulée
import type { BenchmarkSecteur, DiagnosticIA, MoisSuivi, Recommandation } from './diagnostic-schema'
import { calculerImpact, matriceDepuis } from './calcul-financier'
import { adapterAuTemplate } from './adapter-template'
import { TEMPLATE_PAR_DEFAUT, type TemplateId } from './templates'

export const TRANSCRIPTION_DEMO = `Consultant : Merci de me recevoir. Pouvez-vous me présenter la boulangerie ?
Dirigeante : Nous sommes 12 salariés sur deux boutiques, avec un laboratoire de production. On fait environ 850 000 € de chiffre d'affaires.

Consultant : Qu'est-ce qui vous prend le plus de temps chaque semaine ?
Dirigeante : La facturation des clients professionnels : restaurants, cantines, hôtels. Je fais tout à la main sur Excel, puis j'envoie les factures une par une par email. Ça me prend au moins 6 heures par semaine. Et les relances de paiement, je les fais quand j'y pense : certains clients paient à 60 jours.

Consultant : Et les commandes de ces clients professionnels ?
Dirigeante : Elles arrivent par téléphone, par SMS et par WhatsApp. Mon responsable de production recopie tout sur un tableau blanc le soir. On a eu plusieurs erreurs de quantités le mois dernier, et une livraison oubliée.

Consultant : Comment s'organisent les plannings des équipes ?
Dirigeante : Sur un fichier Excel que j'envoie par WhatsApp. Chaque changement, c'est une dizaine de messages. Je passe facilement 3 heures par semaine là-dessus.

Consultant : Et la gestion des stocks de matières premières ?
Dirigeante : On compte à l'œil. Parfois on manque de farine bio, parfois on jette de la crème périmée. Je n'ai aucune idée précise de mes pertes.

Consultant : Qu'aimeriez-vous améliorer en priorité ?
Dirigeante : Gagner du temps sur l'administratif pour me concentrer sur les clients, et arrêter les erreurs de commandes. Et à terme, développer la vente aux entreprises.`

// Nom de l'entreprise fictive sur la page publique /exemple (sans la mention « démo »)
export const NOM_ENTREPRISE_EXEMPLE = 'Boulangerie Dupain'

export const FORMULAIRE_DEMO = {
  entreprise: `${NOM_ENTREPRISE_EXEMPLE} (démo)`,
  secteur: 'Artisanat',
  ca: '850 000 €',
  effectif: '12',
  ville: 'Lyon, Auvergne-Rhône-Alpes',
  transcription: TRANSCRIPTION_DEMO,
  outils: ['WhatsApp', 'Excel'],
  outilsAutre: '',
  tauxHoraire: '35',
  objectifs: ['productivite', 'croissance'],
}

// Diagnostic fictif complet, avec les mêmes calculs financiers que l'API.
// Les 4 cases de la matrice effort / impact sont remplies, pour montrer tout ce que le rapport sait faire.
// options.vitrine = true : sans la mention « 🧪 DÉMO » (page publique /exemple, qui a déjà son bandeau « exemple fictif »)
export function diagnosticDemo(entreprise: string, tauxHoraire: number, options: { vitrine?: boolean } = {}): DiagnosticIA {
  const recommandations: Recommandation[] = [
    {
      id: 'R1', friction_id: 'F1', nom_outil: 'Logiciel de facturation (exemple)', categorie: 'Facturation',
      fonction: 'Crée les factures depuis des modèles et envoie les relances de paiement automatiquement.',
      benefice_concret: 'Gain de 4 h/semaine sur la facturation et les relances',
      cout_mensuel_eur: 30, cout_mise_en_place_eur: 0, heures_economisees_semaine: 4,
      complexite: 'faible', quadrant: 'quick_win', conformite_rgpd: true, alerte_rgpd: null, lien_site: '',
    },
    {
      id: 'R2', friction_id: 'F2', nom_outil: 'Formulaire de commande en ligne (exemple)', categorie: 'Commandes',
      fonction: 'Les clients professionnels commandent via un formulaire unique au lieu du téléphone et de WhatsApp.',
      benefice_concret: 'Fin des erreurs de recopie et gain de 2 h/semaine',
      cout_mensuel_eur: 15, cout_mise_en_place_eur: 200, heures_economisees_semaine: 2,
      complexite: 'faible', quadrant: 'quick_win', conformite_rgpd: true,
      alerte_rgpd: 'Collecte le nom et l’email des clients : prévoir une mention d’information.', lien_site: '',
    },
    {
      id: 'R3', friction_id: 'F3', nom_outil: 'Application de planning (exemple)', categorie: 'RH',
      fonction: 'Plannings partagés sur téléphone, avec échanges de créneaux validés en un clic.',
      benefice_concret: 'Gain de 2 h/semaine sur la gestion des plannings',
      cout_mensuel_eur: 40, cout_mise_en_place_eur: 0, heures_economisees_semaine: 2,
      complexite: 'faible', quadrant: 'quick_win', conformite_rgpd: true,
      alerte_rgpd: 'Traite des données de salariés (horaires) : vérifier l’hébergement en Europe.', lien_site: '',
    },
    {
      id: 'R4', friction_id: 'F4', nom_outil: 'Gestion de stock connectée à la caisse (exemple)', categorie: 'Stocks',
      fonction: 'Suit les matières premières et alerte avant rupture ou péremption.',
      benefice_concret: 'Moins de pertes de matières premières et 1 h/semaine gagnée sur l’inventaire',
      cout_mensuel_eur: 60, cout_mise_en_place_eur: 500, heures_economisees_semaine: 1,
      complexite: 'élevée', quadrant: 'projet_strategique', conformite_rgpd: true, alerte_rgpd: null, lien_site: '',
    },
    {
      id: 'R5', friction_id: 'F1', nom_outil: 'Modèles d’emails et de devis (exemple)', categorie: 'Communication',
      fonction: 'Des modèles prêts à l’emploi pour les devis, les confirmations de commande et les réponses aux questions fréquentes.',
      benefice_concret: '30 minutes gagnées par semaine sur les emails répétitifs',
      cout_mensuel_eur: 0, cout_mise_en_place_eur: 0, heures_economisees_semaine: 0.5,
      complexite: 'faible', quadrant: 'optimisation_simple', conformite_rgpd: true, alerte_rgpd: null, lien_site: '',
    },
    {
      id: 'R6', friction_id: 'F2', nom_outil: 'Logiciel de gestion tout-en-un (ERP) (exemple)', categorie: 'Gestion',
      fonction: 'Un seul logiciel pour la production, les commandes, les stocks et la comptabilité.',
      benefice_concret: 'Trop lourd et trop cher pour 12 salariés aujourd’hui : à reconsidérer une fois les outils simples en place.',
      cout_mensuel_eur: 250, cout_mise_en_place_eur: 5000, heures_economisees_semaine: 0.5,
      complexite: 'élevée', quadrant: 'a_eviter', conformite_rgpd: true, alerte_rgpd: null, lien_site: '',
    },
  ]

  return {
    synthese: {
      situation: `${options.vitrine ? '' : '🧪 DÉMO (réponse simulée, sans IA) — '}${entreprise} perd un temps important sur des tâches administratives faites à la main.`,
      probleme_principal: 'La facturation, les commandes professionnelles et les plannings reposent sur Excel, le téléphone et WhatsApp, ce qui crée des erreurs et des retards de paiement.',
      actions_prioritaires: [
        'Automatiser la facturation et les relances de paiement',
        'Centraliser les commandes professionnelles dans un formulaire unique',
        'Partager les plannings sur une application dédiée',
      ],
      accroche: 'Trois actions simples, réalisables en quelques jours, pour libérer environ 8 heures par semaine.',
    },
    points_friction: [
      { id: 'F1', titre: 'Facturation manuelle', description: 'Les factures sont faites sur Excel et envoyées une par une. Les relances ne sont pas systématiques.', impact_heures_semaine: 6, urgence: 'élevée', categorie: 'processus' },
      { id: 'F2', titre: 'Commandes dispersées', description: 'Les commandes arrivent par téléphone, SMS et WhatsApp, puis sont recopiées à la main.', impact_heures_semaine: 3, urgence: 'élevée', categorie: 'commercial' },
      { id: 'F3', titre: 'Plannings par messages', description: 'Chaque changement de planning demande de nombreux échanges de messages.', impact_heures_semaine: 3, urgence: 'moyenne', categorie: 'rh' },
      { id: 'F4', titre: 'Stocks non suivis', description: 'Les stocks sont estimés à l’œil, ce qui entraîne des ruptures et du gaspillage.', impact_heures_semaine: 1, urgence: 'moyenne', categorie: 'outils' },
    ],
    recommandations,
    matrice: matriceDepuis(recommandations),
    plan_4_jours: [
      { jour: 1, action: 'Créer le compte de facturation et importer la liste des clients professionnels', outil_requis: 'Logiciel de facturation', temps_estime_minutes: 90, responsable: 'Dirigeante', critere_succes: 'Tous les clients pros sont enregistrés' },
      { jour: 2, action: 'Paramétrer les relances automatiques à 30 et 45 jours', outil_requis: 'Logiciel de facturation', temps_estime_minutes: 45, responsable: 'Dirigeante', critere_succes: 'Relances actives sur les factures en retard' },
      { jour: 3, action: 'Mettre en ligne le formulaire de commande et l’envoyer aux clients pros', outil_requis: 'Formulaire de commande', temps_estime_minutes: 120, responsable: 'Responsable production', critere_succes: 'Premières commandes reçues via le formulaire' },
      { jour: 4, action: 'Saisir les plannings de la semaine suivante et inviter les équipes', outil_requis: 'Application de planning', temps_estime_minutes: 60, responsable: 'Dirigeante', critere_succes: 'Tous les salariés voient leur planning sur téléphone' },
    ],
    impact_financier: calculerImpact(recommandations, tauxHoraire),
    opportunites: [
      { titre: 'Vente aux entreprises (plateaux petit-déjeuner)', description: 'Développer une offre pour les entreprises voisines, commandée en ligne.', potentiel_ca_eur: 40000, delai_mise_en_oeuvre: '6-9 mois', prerequis: ['Formulaire de commande en place', 'Capacité de livraison'] },
      { titre: 'Programme de fidélité', description: 'Récompenser les clients réguliers des deux boutiques.', potentiel_ca_eur: 15000, delai_mise_en_oeuvre: '6 mois', prerequis: ['Caisse compatible'] },
      { titre: 'Tableau de bord des marges', description: 'Suivre la marge par produit pour ajuster les prix.', potentiel_ca_eur: 20000, delai_mise_en_oeuvre: '9-12 mois', prerequis: ['Gestion de stock en place'] },
    ],
    alertes_rgpd: [
      { nom_outil: 'Formulaire de commande (exemple)', type_donnees: ['Nom', 'Email', 'Téléphone'], vigilance_requise: 'Informer les clients de l’usage de leurs données.', mesures_recommandees: ['Mention d’information sous le formulaire', 'Durée de conservation définie'] },
      { nom_outil: 'Application de planning (exemple)', type_donnees: ['Nom des salariés', 'Horaires'], vigilance_requise: 'Données de salariés : vérifier l’hébergement en Europe.', mesures_recommandees: ['Signer le contrat de sous-traitance (DPA)', 'Informer les salariés'] },
    ],
  }
}


// ---------------------------------------------------------------------
// Simulation de la réponse de l'IA (mode démo) : aucun appel au serveur, aucun coût
// ---------------------------------------------------------------------

// Copie toute neuve du formulaire de démo (pour ne jamais modifier l'original)
export function copieFormulaireDemo() {
  return { ...FORMULAIRE_DEMO, outils: [...FORMULAIRE_DEMO.outils], objectifs: [...FORMULAIRE_DEMO.objectifs] }
}

// La fausse barre de progression : pourcentage atteint à chaque étape (environ 1 seconde chacune)
export const ETAPES_SIMULATION = [18, 42, 68, 90]
export const DUREE_ETAPE_MS = 900

export const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Parties réservées au template Premium (fictives elles aussi)
export const BENCHMARK_DEMO: BenchmarkSecteur = {
  resume: 'Par rapport à des boulangeries-pâtisseries de taille comparable, l’entreprise est en retard sur la gestion administrative et les commandes professionnelles, mais bien placée sur la qualité et la fidélité de sa clientèle.',
  indicateurs: [
    { indicateur: 'Délai de paiement des clients professionnels', entreprise: '≈ 60 jours pour certains clients', reference_secteur: 'Souvent entre 30 et 45 jours', positionnement: 'en_retard', commentaire: 'Des relances automatiques suffisent en général à gagner 2 à 3 semaines.' },
    { indicateur: 'Temps passé sur l’administratif (dirigeant)', entreprise: '≈ 9 h par semaine', reference_secteur: 'Souvent 4 à 6 h par semaine', positionnement: 'en_retard', commentaire: 'La facturation et les plannings concentrent l’essentiel de l’écart.' },
    { indicateur: 'Prise de commandes professionnelles', entreprise: 'Téléphone, SMS et WhatsApp', reference_secteur: 'Formulaire ou plateforme en ligne de plus en plus courant', positionnement: 'en_retard', commentaire: 'Un canal unique réduit fortement les erreurs de quantités.' },
    { indicateur: 'Suivi des stocks de matières premières', entreprise: 'Estimation à l’œil', reference_secteur: 'Inventaire hebdomadaire simple', positionnement: 'en_retard', commentaire: 'Un suivi même basique limite les ruptures et le gaspillage.' },
    { indicateur: 'Part du chiffre d’affaires avec les professionnels', entreprise: 'Non mesuré', reference_secteur: 'Repère non disponible', positionnement: 'dans_la_moyenne', commentaire: 'À mesurer pour piloter le développement de la vente aux entreprises.' },
    { indicateur: 'Fidélité de la clientèle de boutique', entreprise: 'Forte (clientèle de quartier)', reference_secteur: 'Variable selon l’emplacement', positionnement: 'en_avance', commentaire: 'Un atout à valoriser avec un programme de fidélité.' },
  ],
  bonnes_pratiques: [
    'Envoyer les factures le jour de la livraison, avec relance automatique',
    'Centraliser toutes les commandes professionnelles dans un seul outil',
    'Publier les plannings une semaine à l’avance sur une application',
    'Faire un inventaire rapide chaque semaine des 10 matières premières principales',
    'Suivre chaque mois 3 à 5 chiffres clés (marge, pertes, délais de paiement)',
  ],
  avertissement: '',
}

export const SUIVI_DEMO: MoisSuivi[] = [
  {
    mois: 1,
    objectif: 'Mettre en place les 3 quick wins et envoyer 100 % des factures depuis le nouvel outil',
    actions: ['Paramétrer la facturation et les relances automatiques', 'Lancer le formulaire de commande auprès des clients pros', 'Publier les plannings sur l’application'],
    indicateurs: [{ nom: 'Factures envoyées depuis l’outil', cible: '100 %' }, { nom: 'Commandes reçues via le formulaire', cible: '≥ 50 %' }],
    point_de_suivi: 'Vérifier que les relances partent bien et recueillir l’avis des clients pros sur le formulaire.',
  },
  {
    mois: 2,
    objectif: 'Ancrer les nouvelles habitudes et lancer le suivi des stocks',
    actions: ['Passer 100 % des commandes pros par le formulaire', 'Former le responsable production à l’inventaire hebdomadaire', 'Choisir l’outil de gestion de stock'],
    indicateurs: [{ nom: 'Erreurs de commande', cible: '0 par semaine' }, { nom: 'Délai moyen de paiement', cible: '≤ 45 jours' }],
    point_de_suivi: 'Faire le bilan des erreurs de commande et valider le choix de l’outil de stock.',
  },
  {
    mois: 3,
    objectif: 'Mesurer les gains et préparer la vente aux entreprises',
    actions: ['Comparer le temps administratif avant / après', 'Mesurer les pertes de matières premières', 'Préparer une offre « plateaux petit-déjeuner » pour les entreprises voisines'],
    indicateurs: [{ nom: 'Temps administratif du dirigeant', cible: '≤ 5 h / semaine' }, { nom: 'Pertes de matières premières', cible: '− 30 %' }],
    point_de_suivi: 'Présenter le bilan chiffré des 3 mois et décider des prochaines étapes de l’accompagnement.',
  },
]

// « Réponse de l'IA » en mode démo : le diagnostic fictif, au nom de l'entreprise saisie,
// avec son taux horaire (les montants changent donc selon le formulaire) et au format du template choisi.
// vitrine: true → sans la mention « 🧪 DÉMO » (page publique /exemple)
export function reponseIASimulee(saisie: { entreprise: string; taux_horaire: number; template?: TemplateId; vitrine?: boolean }): DiagnosticIA {
  const entreprise = saisie.entreprise.trim() || FORMULAIRE_DEMO.entreprise
  const taux = Number.isFinite(saisie.taux_horaire) && saisie.taux_horaire > 0 ? saisie.taux_horaire : 40
  const complet: DiagnosticIA = {
    ...diagnosticDemo(entreprise, taux, { vitrine: saisie.vitrine }),
    benchmark_secteur: BENCHMARK_DEMO,
    suivi_3_mois: SUIVI_DEMO,
  }
  return adapterAuTemplate(complet, saisie.template ?? TEMPLATE_PAR_DEFAUT)
}
