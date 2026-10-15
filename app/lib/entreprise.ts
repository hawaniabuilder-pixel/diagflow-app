// 🏢 TES INFORMATIONS : un seul fichier à remplir avant la mise en ligne.
// Elles s'affichent dans : Mentions légales, CGU/CGV, Politique de confidentialité et page d'accueil (tarifs).
//
// ✏️ Remplace chaque texte qui commence par « [À COMPLÉTER ». Tant qu'il n'est pas remplacé,
//    il s'affiche en JAUNE sur le site : impossible de l'oublier.
// ⚖️ Les textes légaux sont des modèles : fais-les relire par un juriste avant d'encaisser des clients.
//
// Ce fichier ne contient que des données (aucune connexion) : il peut être lu partout.

export const A_COMPLETER = '[À COMPLÉTER'

// true si la valeur n'est pas encore remplie
export const estACompleter = (valeur: string | null | undefined) => !valeur || valeur.startsWith(A_COMPLETER)

// --- Qui édite le site (toi) ---
export const ENTREPRISE = {
  nomCommercial: 'Vizion Scan',
  raisonSociale: 'Vision scan en cour de construction',
  formeJuridique: 'Particulier porteur de projet',
  capital: '', // ex. « 1 000 € » pour une société ; laisse vide pour une micro-entreprise
  siret: '',
  rcs: '', // ex. « RCS Lyon 123 456 789 » ; laisse vide si tu n'es pas inscrit au RCS
  tva: '', // numéro de TVA intracommunautaire ; laisse vide si « TVA non applicable, art. 293 B du CGI »
  adresse: '23 rue de la paix 92000 Nanterre',
  email: 'contact@vizionscan.com',
  telephone: '', // facultatif
  directeurPublication: 'Faouzi AHAMADA',
  villeTribunal: 'Nanterre',
  dateMiseAJour: '16 octobre 2026',
}

// --- Où le site est hébergé ---
// Si tu mets le site en ligne avec Vercel, garde ces lignes (adresse à revérifier sur vercel.com/legal).
export const HEBERGEUR_SITE = {
  nom: 'Vercel Inc.',
  adresse: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
  site: 'https://vercel.com',
}
// Base de données et comptes : Supabase. La région est visible dans Supabase > Project Settings > General.
export const HEBERGEUR_DONNEES = {
  nom: 'Supabase Inc.',
  region: '[À COMPLÉTER : région de ton projet Supabase, ex. West EU (Paris) ou Central EU (Frankfurt)]',
  site: 'https://supabase.com',
}

// --- Tes tarifs (page d'accueil et CGV) ---
// Offre SOLO (décidé le 1er octobre 2026 : 29 € HT par mois).
// null = la page d'accueil affiche « Tarif communiqué au lancement ».
export const TARIF_SOLO_MENSUEL: number | null = 29
export const TARIF_SOLO_ANNUEL: number | null = null // ex. 290 (2 mois offerts) le jour où le paiement annuel existe dans Stripe
export const ANALYSES_IA_INCLUSES = 30 // par mois, offres Solo et Équipe (doit correspondre au fichier SQL 13)
export const ANALYSES_OFFERTES_ESSAI = 3 // essai gratuit, au total (doit correspondre au fichier SQL 13)

// Offre ÉQUIPE (déjà utilisée par la page Équipe)
export const PRIX_OFFRE_EQUIPE = 99 // € HT par mois
export const PLACES_OFFRE_EQUIPE = 5
export const JOURS_ESSAI = 14
