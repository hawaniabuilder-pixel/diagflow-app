// Page publique : politique de confidentialité (RGPD).
// ✏️ Les informations se remplissent dans app/lib/entreprise.ts (en jaune tant qu'elles manquent).
// ⚖️ Modèle de départ : à faire relire par un professionnel (juriste / DPO).
import type { Metadata } from 'next'
import PageLegale, { Info, Section } from '../components/PageLegale'
import { ENTREPRISE, HEBERGEUR_DONNEES } from '../lib/entreprise'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Diagnostic IA',
  description: 'Comment Diagnostic IA traite les données personnelles.',
}

export default function ConfidentialitePage() {
  return (
    <PageLegale titre="Politique de confidentialité">
      <Section titre="1. Qui est responsable de vos données ?">
        <p>
          Le service {ENTREPRISE.nomCommercial} est édité par <Info valeur={ENTREPRISE.raisonSociale} />, <Info valeur={ENTREPRISE.adresse} />{' '}
          (SIRET <Info valeur={ENTREPRISE.siret} />).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Pour le <strong>compte du consultant</strong> (email, paramètres), l’éditeur est <strong>responsable du traitement</strong>.
          </li>
          <li>
            Pour les <strong>informations des entreprises clientes</strong> (transcriptions, diagnostics), le consultant est responsable
            du traitement et l’éditeur agit comme <strong>sous-traitant</strong> (article 28 du RGPD).
          </li>
        </ul>
        <p>Contact pour vos données : <Info valeur={ENTREPRISE.email} /></p>
      </Section>

      <Section titre="2. Quelles données sont traitées ?">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Compte du consultant</strong> : email, mot de passe (chiffré), nom, cabinet, logo et réglages.</li>
          <li><strong>Informations sur l’entreprise cliente</strong> : nom, secteur, chiffre d’affaires, effectif, ville et région, outils utilisés, objectifs.</li>
          <li>
            <strong>Transcription de l’entretien</strong> : elle peut contenir des données personnelles
            (noms, fonctions, situations de salariés). Nous recommandons d’en retirer tout ce qui n’est pas utile à l’analyse.
          </li>
          <li><strong>Résultat de l’analyse</strong> : diagnostic généré puis relu par le consultant.</li>
          <li><strong>Compteur d’analyses IA</strong> : date et format de chaque analyse lancée (pour le quota mensuel).</li>
          <li><strong>Équipe</strong> (si utilisée) : membres, rôles, invitations et diagnostics partagés.</li>
        </ul>
      </Section>

      <Section titre="3. Pourquoi ces données sont-elles utilisées ?">
        <p>
          Uniquement pour produire le diagnostic demandé par le consultant et lui permettre de le retrouver, le modifier et le partager
          avec son client. Les données ne sont ni vendues ni utilisées à des fins publicitaires, et ne servent pas à entraîner une IA.
        </p>
        <p>
          Base légale : l’exécution du contrat (les CGU / CGV) pour le compte du consultant ; pour les entreprises clientes, l’accord
          recueilli par le consultant, qui le confirme avant chaque analyse (case à cocher obligatoire, avec la date enregistrée).
        </p>
      </Section>

      <Section titre="4. Qui reçoit les données ?">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>{HEBERGEUR_DONNEES.nom}</strong> : base de données, comptes et fichiers (logos).
            Région d’hébergement : <Info valeur={HEBERGEUR_DONNEES.region} />.
          </li>
          <li>
            <strong>Anthropic</strong> (fournisseur du modèle d’IA Claude) : la transcription et les informations de l’entreprise lui sont
            transmises au moment de l’analyse. Anthropic est une société américaine : il s’agit d’un transfert hors de l’Union européenne,
            encadré par <Info valeur="[À COMPLÉTER : garanties applicables, ex. clauses contractuelles types de la Commission européenne]" />.
          </li>
          <li>
            <strong>Vercel</strong> : hébergement du site (les pages et les échanges passent par ses serveurs).
          </li>
          <li>
            <strong>Stripe</strong> : paiement des abonnements. La carte bancaire est saisie directement sur la page sécurisée de Stripe :
            nous ne voyons jamais son numéro. Nous gardons seulement l’état de l’abonnement (actif, date du prochain prélèvement).
          </li>
          <li>
            <strong>Resend</strong> : envoi des emails automatiques (bienvenue, fin d’essai). Il reçoit l’adresse email du destinataire
            et le contenu du message. Société américaine : transfert hors de l’Union européenne, encadré comme pour Anthropic.
          </li>
        </ul>
        <p>En mode démo, aucune donnée n’est envoyée à l’IA : l’analyse est simulée.</p>
      </Section>

      <Section titre="5. Combien de temps sont-elles conservées ?">
        <p>
          Les diagnostics sont conservés tant que le consultant ne les supprime pas, et au plus
          {' '}<Info valeur="[À COMPLÉTER : durée maximale, ex. 3 ans après la dernière connexion]" />.
          Le consultant peut supprimer un diagnostic à tout moment depuis son tableau de bord : la suppression est définitive.
          La suppression du compte efface tous ses diagnostics, clients, paramètres et son logo.
        </p>
        <p>Les liens de rapport envoyés aux clients expirent automatiquement.</p>
      </Section>

      <Section titre="6. Quels sont vos droits ?">
        <p>
          Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité de vos données.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Télécharger toutes vos données</strong> : Paramètres → 📦 Mes données → « Télécharger ».</li>
          <li><strong>Supprimer votre compte et toutes vos données</strong> : Paramètres → 📦 Mes données → « Supprimer mon compte ».</li>
          <li>Pour tout le reste, écrivez à l’adresse indiquée au point 1 : réponse sous un mois maximum.</li>
        </ul>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </Section>

      <Section titre="7. Sécurité et cookies">
        <p>
          Les échanges sont chiffrés (HTTPS). Chaque consultant n’a accès qu’à ses propres diagnostics (et à ceux que son équipe partage) :
          cette règle est appliquée directement par la base de données. Les liens de partage client sont uniques et ont une date d’expiration.
        </p>
        <p>
          Aucun cookie publicitaire ni de mesure d’audience. Le navigateur garde seulement ce qui est nécessaire : la connexion,
          le mode démo et les brouillons non envoyés quand internet est coupé.
        </p>
      </Section>
    </PageLegale>
  )
}
