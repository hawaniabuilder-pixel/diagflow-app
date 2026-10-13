// Page publique : CONDITIONS GÉNÉRALES D'UTILISATION ET DE VENTE (CGU / CGV).
// Le service est vendu à des PROFESSIONNELS (consultants, cabinets) : ce sont des CGV « B2B ».
// ⚖️ Modèle de départ : à faire relire par un juriste avant d'encaisser des clients.
// ✏️ Les informations se remplissent dans app/lib/entreprise.ts.
import type { Metadata } from 'next'
import PageLegale, { Info, Section } from '../components/PageLegale'
import {
  ANALYSES_IA_INCLUSES,
  ANALYSES_OFFERTES_ESSAI,
  ENTREPRISE,
  JOURS_ESSAI,
  PLACES_OFFRE_EQUIPE,
  PRIX_OFFRE_EQUIPE,
  TARIF_SOLO_MENSUEL,
} from '../lib/entreprise'

export const metadata: Metadata = {
  title: 'CGU / CGV — Vizion',
  description: 'Conditions générales d’utilisation et de vente du service Vizion.',
}

export default function CgvPage() {
  return (
    <PageLegale titre="Conditions générales d’utilisation et de vente">
      <p className="rounded-lg border border-yellow-700 bg-yellow-950/40 p-4 text-sm text-yellow-100">
        ⚖️ Modèle à faire valider par un juriste avant la mise en vente.
      </p>

      <Section titre="1. Objet">
        <p>
          Ces conditions encadrent l’utilisation du service en ligne <strong>{ENTREPRISE.nomCommercial}</strong>, édité par{' '}
          <Info valeur={ENTREPRISE.raisonSociale} /> (voir les <a href="/mentions-legales" className="text-blue-400 underline">mentions légales</a>).
          Créer un compte vaut acceptation de ces conditions.
        </p>
        <p>
          Le service est réservé aux <strong>professionnels</strong> (consultants, cabinets, experts-comptables, coachs…) agissant pour leur activité.
        </p>
      </Section>

      <Section titre="2. Le service">
        <p>
          {ENTREPRISE.nomCommercial} aide le consultant à produire un diagnostic pour une PME à partir d’un entretien : points de friction,
          outils recommandés, plan d’action et estimation chiffrée. L’analyse est générée par une intelligence artificielle.
        </p>
        <p>
          <strong>Le consultant relit et valide chaque rapport avant de l’envoyer.</strong> Les résultats sont des aides à la décision :
          ils ne constituent ni un conseil juridique, ni un conseil fiscal, ni un conseil financier. Les montants sont des estimations
          fondées sur les informations saisies.
        </p>
      </Section>

      <Section titre="3. Compte">
        <p>
          Le consultant fournit une adresse email valide et garde son mot de passe secret. Il est responsable de ce qui est fait depuis son compte.
          Dans l’offre Équipe, l’Admin gère les invitations et les rôles de son équipe.
        </p>
      </Section>

      <Section titre="4. Offres et prix">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Essai gratuit :</strong> {ANALYSES_OFFERTES_ESSAI} analyses IA offertes à l’inscription (au total, sans carte bancaire),
            et le mode démo illimité.
          </li>
          <li>
            <strong>Offre Solo :</strong>{' '}
            {TARIF_SOLO_MENSUEL != null ? `${TARIF_SOLO_MENSUEL} € HT par mois` : 'tarif communiqué au lancement'}, {ANALYSES_IA_INCLUSES} analyses IA par mois.
          </li>
          <li>
            <strong>Offre Équipe :</strong> {PRIX_OFFRE_EQUIPE} € HT par mois pour {PLACES_OFFRE_EQUIPE} places Admin ou Consultant
            (Viewers gratuits), {ANALYSES_IA_INCLUSES} analyses IA par mois et par consultant. Le partage et les invitations
            peuvent être essayés gratuitement pendant {JOURS_ESSAI} jours, sans carte bancaire ; pendant cet essai, chaque membre
            dispose de ses {ANALYSES_OFFERTES_ESSAI} analyses IA offertes.
          </li>
        </ul>
        <p>
          Les abonnements sont mensuels et sans engagement. Le paiement se fait par carte bancaire sur la page sécurisée de Stripe,
          avec un prélèvement automatique chaque mois. Si l’abonnement est souscrit pendant l’essai gratuit, le premier prélèvement
          a lieu à la fin de l’essai. On résilie à tout moment dans <strong>Paramètres → Mon offre → Gérer mon abonnement</strong> (Solo)
          ou <strong>Équipe → Gérer mon abonnement</strong> (Admin de l’équipe) :
          la résiliation prend effet à la fin du mois déjà payé, sans remboursement du mois en cours. En cas d’échec de paiement,
          l’accès aux fonctions payantes est suspendu quelques jours plus tard si la situation n’est pas régularisée.
          Les prix des rapports vendus par le consultant à ses propres clients (ex. Express, Complet, Premium) sont libres :
          ceux affichés dans l’outil sont seulement des prix conseillés.
        </p>
      </Section>

      <Section titre="5. Utilisation raisonnable de l’IA">
        <p>
          Chaque analyse IA a un coût. Les offres Solo et Équipe comprennent <strong>{ANALYSES_IA_INCLUSES} analyses par mois</strong> et par consultant
          (remise à zéro le 1er du mois) ; l’essai gratuit en comprend {ANALYSES_OFFERTES_ESSAI} au total,
          avec un maximum de 5 analyses en 10 minutes. Une analyse qui échoue n’est pas comptée. Le mode démo est illimité.
          Un quota plus élevé peut être accordé sur demande.
        </p>
      </Section>

      <Section titre="6. Obligations du consultant">
        <ul className="list-disc space-y-1 pl-5">
          <li>Informer l’entreprise cliente et obtenir son accord avant d’analyser ses informations (case RGPD à cocher avant chaque analyse).</li>
          <li>Ne saisir que les données utiles : retirer des transcriptions les données personnelles inutiles (noms de salariés, santé…).</li>
          <li>Ne pas utiliser le service pour des contenus illicites, ni tenter d’en contourner la sécurité ou les quotas.</li>
        </ul>
      </Section>

      <Section titre="7. Données personnelles">
        <p>
          Pour les données de ses clients, le consultant est <strong>responsable du traitement</strong> et {ENTREPRISE.nomCommercial} agit comme
          <strong> sous-traitant</strong> (article 28 du RGPD) : les données servent uniquement à produire et stocker les diagnostics.
          Tout est détaillé dans la <a href="/confidentialite" className="text-blue-400 underline">politique de confidentialité</a>.
        </p>
      </Section>

      <Section titre="8. Propriété">
        <p>
          Le consultant reste propriétaire de ses contenus (transcriptions, rapports, logo). Il peut les télécharger à tout moment
          dans <strong>Paramètres → Mes données</strong>. Le logiciel et sa marque restent la propriété de l’éditeur.
        </p>
      </Section>

      <Section titre="9. Disponibilité et responsabilité">
        <p>
          L’éditeur fait ses meilleurs efforts pour que le service soit disponible et sécurisé, sans pouvoir garantir une disponibilité totale
          (maintenance, panne d’un prestataire…). Sa responsabilité est limitée aux dommages directs et, au plus, aux sommes payées
          par le consultant au cours des 12 derniers mois.
        </p>
      </Section>

      <Section titre="10. Résiliation">
        <p>
          Le consultant peut arrêter à tout moment et supprimer son compte dans <strong>Paramètres → Mes données</strong>,
          après avoir résilié son abonnement en cours :
          le compte et toutes ses données sont alors effacés définitivement. L’éditeur peut suspendre un compte en cas de manquement grave
          à ces conditions, après avertissement sauf urgence.
        </p>
      </Section>

      <Section titre="11. Modifications et droit applicable">
        <p>
          Ces conditions peuvent évoluer : le consultant est prévenu avant toute modification importante. Elles sont soumises au droit français.
          En cas de litige, et après une tentative de solution amiable, le tribunal compétent est celui de <Info valeur={ENTREPRISE.villeTribunal} />.
        </p>
        <p>Contact : <Info valeur={ENTREPRISE.email} /></p>
      </Section>
    </PageLegale>
  )
}
