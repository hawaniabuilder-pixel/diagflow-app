// Page publique : MENTIONS LÉGALES (obligatoires pour tout site professionnel en France, loi LCEN).
// ✏️ Les informations se remplissent dans app/lib/entreprise.ts (en jaune tant qu'elles manquent).
import type { Metadata } from 'next'
import PageLegale, { Info, Section } from '../components/PageLegale'
import { ENTREPRISE, HEBERGEUR_DONNEES, HEBERGEUR_SITE } from '../lib/entreprise'

export const metadata: Metadata = {
  title: 'Mentions légales — Vizion',
  description: 'Éditeur, hébergeurs et contact du service Vizion.',
}

export default function MentionsLegalesPage() {
  return (
    <PageLegale titre="Mentions légales">
      <Section titre="1. Éditeur du site">
        <ul className="list-none space-y-1">
          <li><strong>Nom ou société :</strong> <Info valeur={ENTREPRISE.raisonSociale} /></li>
          <li><strong>Forme juridique :</strong> <Info valeur={ENTREPRISE.formeJuridique} /></li>
          {ENTREPRISE.capital && <li><strong>Capital social :</strong> {ENTREPRISE.capital}</li>}
          <li><strong>SIRET :</strong> <Info valeur={ENTREPRISE.siret} /></li>
          {ENTREPRISE.rcs && <li><strong>Immatriculation :</strong> {ENTREPRISE.rcs}</li>}
          <li>
            <strong>TVA :</strong>{' '}
            <Info valeur={ENTREPRISE.tva} siVide="TVA non applicable, article 293 B du Code général des impôts" />
          </li>
          <li><strong>Adresse :</strong> <Info valeur={ENTREPRISE.adresse} /></li>
          <li><strong>Email :</strong> <Info valeur={ENTREPRISE.email} /></li>
          {ENTREPRISE.telephone && <li><strong>Téléphone :</strong> {ENTREPRISE.telephone}</li>}
        </ul>
      </Section>

      <Section titre="2. Directeur de la publication">
        <p><Info valeur={ENTREPRISE.directeurPublication} /></p>
      </Section>

      <Section titre="3. Hébergement">
        <p>
          <strong>Site internet :</strong> {HEBERGEUR_SITE.nom}, {HEBERGEUR_SITE.adresse} —{' '}
          <a href={HEBERGEUR_SITE.site} className="text-blue-400 underline" rel="noopener noreferrer" target="_blank">{HEBERGEUR_SITE.site.replace('https://', '')}</a>
        </p>
        <p>
          <strong>Base de données et comptes :</strong> {HEBERGEUR_DONNEES.nom} — région d’hébergement : <Info valeur={HEBERGEUR_DONNEES.region} /> —{' '}
          <a href={HEBERGEUR_DONNEES.site} className="text-blue-400 underline" rel="noopener noreferrer" target="_blank">{HEBERGEUR_DONNEES.site.replace('https://', '')}</a>
        </p>
      </Section>

      <Section titre="4. Propriété intellectuelle">
        <p>
          Les textes, le logiciel et le design de {ENTREPRISE.nomCommercial} sont protégés. Toute reproduction sans autorisation est interdite.
          Les rapports produits par un consultant avec le service lui appartiennent (voir les <a href="/cgv" className="text-blue-400 underline">CGU / CGV</a>).
        </p>
      </Section>

      <Section titre="5. Données personnelles et cookies">
        <p>
          Le traitement des données est expliqué dans la <a href="/confidentialite" className="text-blue-400 underline">politique de confidentialité</a>.
          Le site n’utilise <strong>aucun cookie publicitaire ni de mesure d’audience</strong> : seulement ce qui est nécessaire pour rester connecté
          et garder vos réglages (mode démo, brouillons hors ligne) dans votre navigateur.
        </p>
      </Section>
    </PageLegale>
  )
}
