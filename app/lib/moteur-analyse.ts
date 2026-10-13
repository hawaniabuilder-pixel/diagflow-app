// Moteur d'analyse déterministe DiagFlow
// Même input → même output garanti

export type Friction = {
  titre: string;
  description: string;
  categorie: string;
  heuresSemaine: number;
  urgence: 'faible' | 'moyenne' | 'élevée';
  indices: string[];
};

export type Recommandation = {
  nom: string;
  categorie: string;
  benefice: string;
  coutMensuel: number;
  heuresGagnees: number;
  complexite: 'faible' | 'moyenne' | 'élevée';
  rgpd: boolean;
  quadrant: 'quick-win' | 'stratégique' | 'optimisation' | 'à éviter';
  confiance: number;
};

export type DiagnosticComplet = {
  entreprise: string;
  secteur: string;
  ville: string;
  region: string;
  effectif: number;
  ca: number;
  tauxHoraire: number;
  scoreTotal: number;
  scores: {
    communication: number;
    processus: number;
    finance: number;
    commercial: number;
    stocks: number;
    rh: number;
    visibilite: number;
    achats: number;
  };
  heuresPerdues: number;
  heuresRecuperables: number;
  gainMensuel: number;
  gainAnnuel: number;
  coutOutilsMensuel: number;
  roiNetAnnuel: number;  scoreMaturite: number;
    synthese: string;
      [cle: string]: any;
  dimensions: { nom: string; score: number; label: string }[];
  maturiteParDimension: { nom: string; score: number; label: string }[];
  delaiRemboursement: number;
  financier: {
    gainMensuel: number;
    gainAnnuel: number;
    coutOutilsMensuel: number;
    roiNetAnnuel: number;
    roiAnnuelNet: number;
    [cle: string]: any;
    heuresSemaine: number;    
    delaiRemboursement: number;
  };
  frictions: Friction[];
    recommandations: Recommandation[];
  feuilleDeRoute: { periode: string; actions: string[] }[];
  kpis: string[];
 
 };
 // Grille de scoring déterministe

// Grille de scoring déterministe
function detecterSignaux(transcription: string): Record<string, boolean> {
  const t = transcription.toLowerCase();
  return {
    emailPro: /email|mail|courriel/.test(t),
    collaboratif: /slack|teams|whatsapp|discord/.test(t),
    siteWeb: /site web|site internet|www\./.test(t),
    reseauxSociaux: /facebook|instagram|linkedin|twitter|réseaux sociaux/.test(t),
    newsletter: /newsletter|mailchimp|brevo|emailing/.test(t),
    papier: /papier|manuscrit/.test(t),
    manuel: /manuel|à la main|manuellement/.test(t),
    excel: /excel|tableur|spreadsheet/.test(t),
    outilMetier: /notion|trello|asana|monday|clickup/.test(t),
    workflow: /workflow|automatisation|automatisé|zapier|make/.test(t),
    documentation: /documentation|procédure|mode opératoire/.test(t),
    logicielCompta: /quickbooks|ebp|sage|pennylane|indy|comptable/.test(t),
    facturationElec: /facture électronique|facturation|demat/.test(t),
    tableauBord: /tableau de bord|dashboard|kpi/.test(t),
    previsionnel: /prévisionnel|trésorerie|cash flow/.test(t),
    crm: /hubspot|pipedrive|zoho|nocrm|salesforce/.test(t) || (/(?:utilisons|avons|utilise|souscrit)[^.\n]{0,40}crm/.test(t) && !/n'avons rien|aucun crm|pas de crm|sans crm/.test(t)),
    pipeline: /pipeline|entonnoir|prospects/.test(t),
    relancesAuto: /relance automatique|mailing|campagne/.test(t),
    devisDemat: /devis|facture|devis en ligne/.test(t),
    logicielStock: /(?:logiciel|outil|application|erp)[^.\n]{0,40}stock/.test(t) && !/papier[^.\n]{0,80}stock|stock[^.\n]{0,40}(papier|manuel|cahier)/.test(t),
    inventaireRegulier: /inventaire|comptage|récolement/.test(t),
    seuilsAlerte: /seuil|alerte|rupture|péremption/.test(t) && !/sans seuil|aucun seuil|aucune alerte|au feeling/.test(t),
    
    outilPlanning: /skello|payfit|shifts|pointage/.test(t) || (/(?:utilisons|avons|utilise)[^.\n]{0,40}planning/.test(t) && !/planning[^.\n]{0,60}(manuel|manuellement|papier|tableau)/.test(t)),
    entretiensAnnuels: /entretien annuel|évaluation|feedback/.test(t),
    siteWebActif: /site web|site internet|www\./.test(t),
    googleMyBusiness: /google my business|google maps|avis google/.test(t),
    avisClients: /avis client|google avis|trustpilot/.test(t),
     registreFournisseurs: /registre[^.\n]{0,40}(fournisseur|achat)|fournisseurs[^.\n]{0,40}(registre|fichier|suivi)/.test(t),
    negociationAnnuelle: /négociation|appel d'offres|comparaison/.test(t),
  };
}

function calculerScores(signaux: Record<string, boolean>) {
  const communication = [
    signaux.emailPro ? 20 : 0,
    signaux.collaboratif ? 20 : 0,
    signaux.siteWeb ? 20 : 0,
    signaux.reseauxSociaux ? 20 : 0,
    signaux.newsletter ? 20 : 0,
  ].reduce((a, b) => a + b, 0);

  let processus = 50;
  if (signaux.papier || signaux.manuel) processus -= 30;
  if (signaux.excel && !signaux.workflow) processus -= 20;
  if (signaux.outilMetier) processus += 30;
  if (signaux.workflow) processus += 30;
  if (signaux.documentation) processus += 20;
  processus = Math.max(0, Math.min(100, processus));

  const finance = [
    signaux.logicielCompta ? 30 : 0,
    signaux.facturationElec ? 30 : 0,
    signaux.tableauBord ? 20 : 0,
    signaux.previsionnel ? 20 : 0,
  ].reduce((a, b) => a + b, 0);

  const commercial = [
    signaux.crm ? 25 : 0,
    signaux.pipeline ? 25 : 0,
    signaux.relancesAuto ? 25 : 0,
    signaux.devisDemat ? 25 : 0,
  ].reduce((a, b) => a + b, 0);

  const stocks = [
    signaux.logicielStock ? 40 : 0,
    signaux.inventaireRegulier ? 30 : 0,
    signaux.seuilsAlerte ? 30 : 0,
  ].reduce((a, b) => a + b, 0);

  const rh = [
    signaux.outilPlanning ? 40 : 0,
    signaux.paieExternalisee ? 30 : 0,
    signaux.entretiensAnnuels ? 30 : 0,
  ].reduce((a, b) => a + b, 0);

  const visibilite = [
    signaux.siteWebActif ? 40 : 0,
    signaux.googleMyBusiness ? 30 : 0,
    signaux.avisClients ? 30 : 0,
  ].reduce((a, b) => a + b, 0);

  const achats = [
    signaux.registreFournisseurs ? 50 : 0,
    signaux.negociationAnnuelle ? 50 : 0,
  ].reduce((a, b) => a + b, 0);

  const scoreTotal = Math.round(
    (communication * 0.15 +
      processus * 0.20 +
      finance * 0.15 +
      commercial * 0.15 +
      stocks * 0.10 +
      rh * 0.10 +
      visibilite * 0.10 +
      achats * 0.05)
  );

  return {
    communication,
    processus,
    finance,
    commercial,
    stocks,
    rh,
    visibilite,
    achats,
    scoreTotal,
  };
}

function calculerHeuresPerdues(signaux: Record<string, boolean>, scores: any): number {
  let heures = 8; // base TPE
  if (signaux.papier) heures += 2;
  if (signaux.manuel) heures += 2;
  if (signaux.excel && !signaux.workflow) heures += 2;
  
  // +1h par dimension avec score < 50
  const dimensions = [scores.processus, scores.commercial, scores.stocks, scores.rh, scores.visibilite, scores.achats];
  dimensions.forEach(s => { if (s < 50) heures += 1; });
  
  return Math.min(20, heures); // plafond 20h
}

function detecterFrictions(transcription: string, signaux: Record<string, boolean>): Friction[] {
  const frictions: Friction[] = [];
  const t = transcription.toLowerCase();

  if (signaux.papier || signaux.manuel) {
    const citations = [];
    if (/papier/.test(t)) citations.push('papier');
    if (/manuel/.test(t)) citations.push('manuel');
    frictions.push({
      titre: 'Processus manuels non automatisés',
      description: 'Des tâches répétitives sont réalisées à la main (saisie, recopie). Erreurs fréquentes et temps non valorisé.',
      categorie: 'Processus',
      heuresSemaine: 5,
      urgence: 'élevée',
      indices: citations,
    });
  }

  if (/commercial|vente|devis|prospect/.test(t) && !signaux.crm) {
    frictions.push({
      titre: 'Cycle de vente lent et non piloté',
      description: 'La production de devis et le suivi des prospects reposent sur l\'humain, sans pipeline ni relances systématiques.',
      categorie: 'Commercial',
      heuresSemaine: 4,
      urgence: 'moyenne',
      indices: ['commercial'],
    });
  }

  if (/stock|inventaire|rupture|péremption/.test(t) && !signaux.logicielStock) {
    frictions.push({
      titre: 'Gestion des stocks réactive',
      description: 'Les commandes fournisseurs sont pilotées au feeling : ruptures vendeuses et pertes par péremption coexistent.',
      categorie: 'Stocks',
      heuresSemaine: 3,
      urgence: 'moyenne',
      indices: ['stock'],
    });
  }

  if (/planning|pointage|congés|heures/.test(t) && !signaux.outilPlanning) {
    frictions.push({
      titre: 'Planning et pointage manuels',
      description: 'La gestion des heures et des congés consomme du temps de direction et génère des tensions d\'équipe.',
      categorie: 'RH',
      heuresSemaine: 2,
      urgence: 'moyenne',
      indices: ['planning'],
    });
  }

  if (/fournisseur|commande|achat/.test(t) && !signaux.registreFournisseurs) {
    frictions.push({
      titre: 'Suivi fournisseurs non fiabilisé',
      description: 'Absence de registre centralisé : doubles paiements et pénalités de retard évitables.',
      categorie: 'Achats',
      heuresSemaine: 2,
      urgence: 'faible',
      indices: ['commande'],
    });
  }

  return frictions;
}

function genererRecommandations(scores: any, signaux: Record<string, boolean>): Recommandation[] {
  const recos: Recommandation[] = [];

  if (scores.processus < 70) {
    recos.push({
      nom: 'Notion + automatisations simples',
      categorie: 'Processus',
      benefice: 'Base documentaire unique et workflows automatisés : fin de la double saisie.',
      coutMensuel: 10,
      heuresGagnees: 4,
      complexite: 'faible',
      rgpd: true,
      quadrant: 'quick-win',
      confiance: 89,
    });
  }

  if (scores.commercial < 70) {
    recos.push({
      nom: 'HubSpot CRM (gratuit) ou Pipedrive',
      categorie: 'Commercial',
      benefice: 'Pipeline visuel et relances automatisées : +15 à 25% de conversion constatée.',
      coutMensuel: 0,
      heuresGagnees: 3,
      complexite: 'faible',
      rgpd: true,
      quadrant: 'quick-win',
      confiance: 73,
    });
  }

  if (scores.stocks < 70) {
    recos.push({
      nom: 'Outil de gestion de stock sectoriel',
      categorie: 'Stocks',
      benefice: 'Seuils d\'alerte automatiques : pertes réduites de 25 à 40%.',
      coutMensuel: 50,
      heuresGagnees: 3,
      complexite: 'moyenne',
      rgpd: true,
      quadrant: 'stratégique',
      confiance: 73,
    });
  }

  if (scores.rh < 70) {
    recos.push({
      nom: 'Skello ou PayFit',
      categorie: 'RH',
      benefice: 'Planning collaboratif et pointage mobile : export paie automatique.',
      coutMensuel: 60,
      heuresGagnees: 2,
      complexite: 'faible',
      rgpd: true,
      quadrant: 'optimisation',
      confiance: 73,
    });
  }

  if (scores.achats < 70) {
    recos.push({
      nom: 'Registre achats dans l\'outil comptable',
      categorie: 'Achats',
      benefice: 'Engagements fournisseurs suivis : zéro pénalité et vision cash à 30 jours.',
      coutMensuel: 0,
      heuresGagnees: 2,
      complexite: 'faible',
      rgpd: true,
      quadrant: 'optimisation',
      confiance: 73,
    });
  }

  return recos;
}

export async function analyserTranscription(params: {
  transcription: string;
  entreprise: string;
  secteur: string;
  ville: string;
  region: string;
  effectif: number;
  ca: number;
  tauxHoraire: number;
}): Promise<DiagnosticComplet> {
  const { transcription, entreprise, secteur, ville, region, effectif, ca, tauxHoraire } = params;

  // 1. Détection des signaux
  const signaux = detecterSignaux(transcription);

  // 2. Calcul des scores (déterministe)
  const scores = calculerScores(signaux);

  // 3. Calcul des heures perdues
  const heuresPerdues = calculerHeuresPerdues(signaux, scores);
  const heuresRecuperables = Math.round(heuresPerdues * 0.7);

  // 4. Calcul financier
  const gainMensuel = Math.round(heuresRecuperables * tauxHoraire * 4.33);
  const gainAnnuel = gainMensuel * 12;

  // 5. Détection des frictions
  const frictions = detecterFrictions(transcription, signaux);

  // 6. Recommandations
  const recommandations = genererRecommandations(scores, signaux);
  const coutOutilsMensuel = recommandations.reduce((sum, r) => sum + r.coutMensuel, 0);
  const roiNetAnnuel = gainAnnuel - (coutOutilsMensuel * 12);

  // 7. Feuille de route
  const quickWins = recommandations.filter(r => r.quadrant === 'quick-win');
  const strategiques = recommandations.filter(r => r.quadrant === 'stratégique');
  
  const feuilleDeRoute = [
    {
      periode: 'Jours 1-30 · Quick wins',
      actions: quickWins.length > 0 
        ? quickWins.map(r => `Déployer ${r.nom}`)
        : ['Déployer les outils prioritaires'],
    },
    {
      periode: 'Jours 31-60 · Structuration',
      actions: strategiques.length > 0
        ? strategiques.map(r => `Déployer ${r.nom}`)
        : ['Consolider les processus'],
    },
    {
      periode: 'Jours 61-90 · Optimisation',
      actions: ['Mesurer les KPI', 'Ajuster les processus', 'Former les équipes'],
    },
  ];

  // 8. KPIs
  const kpis = [
    'Heures administratives / semaine',
    'Délai moyen de réponse client (h)',
    'Taux de relances effectuées (%)',
    'Délai moyen de paiement (jours)',
  ];

    // 9. Synthèse exécutive (texte garanti)
  const synthese =
    `${entreprise} (${secteur}, ${effectif} salariés, ${ville}) présente un score de maturité digitale de ${scores.scoreTotal}/100. ` +
    `${frictions.length} point(s) de friction majeur(s) identifié(s), représentant ${heuresPerdues} h/semaine de temps non productif, ` +
    `dont ${heuresRecuperables} h récupérables grâce aux outils recommandés, soit ${gainMensuel} €/mois au taux de ${tauxHoraire} €/h. ` +
    `Les quick wins prioritaires sont déployables sous 30 jours pour un investissement mensuel de ${coutOutilsMensuel} €.`;

  // 10. Délai de remboursement (en mois)
  const delaiRemboursement = Math.max(1, Math.ceil(coutOutilsMensuel / Math.max(1, gainMensuel)));
  const moySectorielle = 12;
  const benchmark = `Dans le secteur ${secteur}, une PME de ${effectif} salariés perd en moyenne ${moySectorielle} h/semaine en tâches non structurées. Ce diagnostic en révèle ${heuresPerdues} h, soit une exposition ${heuresPerdues > moySectorielle ? 'supérieure' : 'inférieure'} à la moyenne sectorielle.`;

  // 11. Dimensions avec libellés (pour l'affichage du rapport)
  const libelle = (s: number) => (s >= 81 ? 'Optimisé' : s >= 61 ? 'Mature' : s >= 41 ? 'En construction' : 'Critique');
  const dimensions = [
    { nom: 'Communication', score: scores.communication, label: libelle(scores.communication) },
    { nom: 'Processus', score: scores.processus, label: libelle(scores.processus) },
    { nom: 'Finance', score: scores.finance, label: libelle(scores.finance) },
    { nom: 'Commercial', score: scores.commercial, label: libelle(scores.commercial) },
    { nom: 'Stocks', score: scores.stocks, label: libelle(scores.stocks) },
    { nom: 'RH', score: scores.rh, label: libelle(scores.rh) },
    { nom: 'Visibilité', score: scores.visibilite, label: libelle(scores.visibilite) },
    { nom: 'Achats', score: scores.achats, label: libelle(scores.achats) },
  ];
    const dimensionsCompletes = dimensions.map(d => ({ ...d, statut: d.label, libelle: d.label, niveau: d.label }));

  return {
  entreprise,
  secteur,
  ville,
  region,
  effectif,
  ca,
  tauxHoraire,
  scoreTotal: scores.scoreTotal,
      scoreMaturite: scores.scoreTotal,
          synthese,
        dimensions: dimensionsCompletes,
    maturiteParDimension: dimensionsCompletes,
    delaiRemboursement, delaiMois: delaiRemboursement, delaiRemboursementMois: delaiRemboursement, delai: delaiRemboursement,
    
  scores,
  heuresPerdues,
  heuresRecuperables,
      gainMensuel,
    gainAnnuel,
    coutOutilsMensuel,
    roiNetAnnuel,
  financier: {
    gainMensuel,
    gainAnnuel,
    coutOutilsMensuel,
          roiAnnuelNet: roiNetAnnuel,
      heuresSemaine: heuresRecuperables,
  roiNetAnnuel,
  delaiRemboursement,},
  frictions,
  recommandations,
  feuilleDeRoute,
  kpis,
};
};
