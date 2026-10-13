// Relances après l'envoi du rapport : J+3, J+7, J+14.
// Les textes ci-dessous sont des modèles : modifiez-les librement pour qu'ils vous ressemblent.

export type EtapeRelance = 'j3' | 'j7' | 'j14'

export type InfosRelance = {
  entreprise: string
  envoye_at: string | null
  mission_signee: boolean
  relances_stoppees: boolean
  statut: string
  relance_j3_at: string | null
  relance_j7_at: string | null
  relance_j14_at: string | null
}

export const ETAPES: { cle: EtapeRelance; jours: number; libelle: string; colonne: 'relance_j3_at' | 'relance_j7_at' | 'relance_j14_at' }[] = [
  { cle: 'j3', jours: 3, libelle: 'J+3 · Questions', colonne: 'relance_j3_at' },
  { cle: 'j7', jours: 7, libelle: 'J+7 · Mise en place', colonne: 'relance_j7_at' },
  { cle: 'j14', jours: 14, libelle: 'J+14 · Offre accompagnement', colonne: 'relance_j14_at' },
]

const JOUR_MS = 24 * 60 * 60 * 1000

export function joursDepuisEnvoi(envoyeAt: string, maintenant = new Date()) {
  return Math.floor((maintenant.getTime() - new Date(envoyeAt).getTime()) / JOUR_MS)
}

// Quelle relance faut-il faire aujourd'hui pour ce diagnostic ? (null = aucune)
// Règle : on propose l'étape la plus avancée dont la date est passée, si elle n'est pas faite
// et qu'aucune étape plus tardive n'a déjà été faite. On s'arrête si la mission est signée,
// si le client ne veut plus de relance, ou si le dossier est clos.
export function relanceDue(d: InfosRelance, maintenant = new Date()) {
  if (!d.envoye_at || d.mission_signee || d.relances_stoppees || d.statut === 'clos') return null
  const jours = joursDepuisEnvoi(d.envoye_at, maintenant)
  for (let i = ETAPES.length - 1; i >= 0; i--) {
    const etape = ETAPES[i]
    if (jours >= etape.jours) {
      const dejaFaiteOuDepassee = ETAPES.slice(i).some((e) => d[e.colonne])
      return dejaFaiteOuDepassee ? null : etape
    }
  }
  return null
}

// Prochaine relance à venir (pour information)
export function prochaineRelance(d: InfosRelance, maintenant = new Date()) {
  if (!d.envoye_at || d.mission_signee || d.relances_stoppees || d.statut === 'clos') return null
  const jours = joursDepuisEnvoi(d.envoye_at, maintenant)
  const etape = ETAPES.find((e) => e.jours > jours && !d[e.colonne])
  if (!etape) return null
  return { etape, date: new Date(new Date(d.envoye_at).getTime() + etape.jours * JOUR_MS) }
}

const DESINSCRIPTION = '\n\n—\nSi vous ne souhaitez plus recevoir de message à ce sujet, répondez simplement « STOP ».'

// Modèles d'emails
// fin = lien de RDV + signature du consultant (voir finEmail dans lib/profil.ts)
export function modeleEmail(etape: EtapeRelance, entreprise: string, lienRapport: string | null, fin = '') {
  const lien = lienRapport ? `\n\nPour rappel, votre diagnostic est consultable ici : ${lienRapport}` : ''

  switch (etape) {
    case 'j3':
      return {
        objet: `Votre Vizion – avez-vous des questions ?`,
        corps: `Bonjour,\n\nJe voulais m'assurer que vous aviez bien reçu le diagnostic de ${entreprise} et savoir si vous aviez pu le parcourir.\n\nAvez-vous des questions sur les points de friction identifiés ou sur les outils recommandés ? Je peux vous l'expliquer de vive voix en 15 minutes, par téléphone ou en visio.${lien}\n\nBien cordialement,${fin}${DESINSCRIPTION}`,
      }
    case 'j7':
      return {
        objet: `${entreprise} – on met en place les premières recommandations ?`,
        corps: `Bonjour,\n\nLe plan d'action du diagnostic prévoit des « quick wins » réalisables en quelques jours, avec un gain de temps rapide pour vos équipes.\n\nSouhaitez-vous que je vous accompagne pour les mettre en place ? Je peux vous proposer un planning et un chiffrage précis lors d'un court échange.${lien}\n\nBien cordialement,${fin}${DESINSCRIPTION}`,
      }
    case 'j14':
      return {
        objet: `${entreprise} – offre d'accompagnement : -20 %`,
        corps: `Bonjour,\n\nPour vous aider à passer du diagnostic à l'action, je vous propose une remise de 20 % sur l'accompagnement à la mise en place des recommandations, pour toute mission démarrée d'ici la fin du mois.\n\nL'accompagnement comprend la configuration des outils, la formation de vos équipes et le suivi des résultats.\n\nVoulez-vous que nous en parlions cette semaine ?${lien}\n\nBien cordialement,${fin}${DESINSCRIPTION}`,
      }
  }
}

export function lienMailto(email: string | null, objet: string, corps: string) {
  return `mailto:${encodeURIComponent(email ?? '')}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`
}
