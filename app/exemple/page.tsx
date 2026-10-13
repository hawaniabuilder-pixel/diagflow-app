// Page PUBLIQUE : un rapport d'exemple, visible sans compte.
// Le prospect voit exactement ce que reçoit le client d'un consultant, avant de s'inscrire.
// ⚠️ Tout est FICTIF (entreprise, consultant, chiffres, outils) : ce sont les données du Mode Démo.
import type { Metadata } from 'next'
import RapportDiagnostic from '../components/RapportDiagnostic'
import PiedDePageLegal from '../components/PiedDePageLegal'
import { FORMULAIRE_DEMO, NOM_ENTREPRISE_EXEMPLE, reponseIASimulee } from '../lib/demo-data'
import { TEMPLATE_IDS, TEMPLATES, templateSur } from '../lib/templates'
import { ANALYSES_OFFERTES_ESSAI, ENTREPRISE } from '../lib/entreprise'

export const metadata: Metadata = {
  title: 'Exemple de rapport — Diagnostic IA',
  description: 'Un exemple complet de diagnostic IA pour une PME française : points de friction, outils, plan d’action et gains en euros.',
}

// Le consultant fictif qui « signe » l'exemple
const CONSULTANT_FICTIF = 'Camille Martin · CM Conseil (consultant fictif)'
const COULEUR = '#2563eb'

export default async function ExemplePage({ searchParams }: {
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>
}) {
  const { format } = await searchParams
  const template = templateSur(typeof format === 'string' ? format : 'premium')
  const diagnostic = reponseIASimulee({
    entreprise: NOM_ENTREPRISE_EXEMPLE, // sans « (démo) » : le bandeau ci-dessous dit déjà que c'est fictif
    taux_horaire: Number(FORMULAIRE_DEMO.tauxHoraire),
    template,
    vitrine: true, // sans la mention « 🧪 DÉMO (réponse simulée) » dans la synthèse
  })

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 pt-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Bandeau : c'est un exemple */}
        <div className="mb-8 rounded-xl border border-blue-700 bg-blue-950/40 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">📄 Exemple de rapport, tel que le reçoit le client</p>
              <p className="mt-1 text-sm text-blue-100/80">
                Entreprise, consultant, chiffres et outils sont <strong>fictifs</strong>. Avec {ENTREPRISE.nomCommercial}, le vôtre porte votre logo et vos couleurs.
              </p>
            </div>
            <a href="/signup" className="shrink-0 rounded-lg bg-blue-600 px-5 py-3 text-center text-sm font-semibold transition hover:bg-blue-700">
              Créer le mien : {ANALYSES_OFFERTES_ESSAI} analyses offertes
            </a>
          </div>
          {/* Choix du format */}
          <nav aria-label="Format du rapport" className="mt-4 flex flex-wrap gap-2">
            {TEMPLATE_IDS.map((id) => {
              const t = TEMPLATES[id]
              const actif = id === template
              return (
                <a key={id} href={`/exemple?format=${id}`} aria-current={actif ? 'page' : undefined}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${actif ? 'border-blue-400 bg-blue-500/20 font-semibold text-white' : 'border-gray-600 text-gray-300 hover:border-gray-400'}`}>
                  {t.emoji} {t.nom} · {t.pages} page{t.pages > 1 ? 's' : ''} · {t.prix} € conseillé
                </a>
              )
            })}
          </nav>
        </div>

        {/* Le rapport, comme sur la page client */}
        <div className="mb-8 h-1.5 w-full rounded-full" style={{ backgroundColor: COULEUR }} />
        <header className="mb-10 border-b border-gray-800 pb-8">
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: COULEUR }}>Diagnostic stratégique IA</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{NOM_ENTREPRISE_EXEMPLE}</h1>
          <p className="mt-3 text-gray-400">
            {FORMULAIRE_DEMO.secteur} · {FORMULAIRE_DEMO.effectif} salariés · {FORMULAIRE_DEMO.ville} · Réalisé par {CONSULTANT_FICTIF}
          </p>
        </header>

        <RapportDiagnostic d={diagnostic} mode="client" />

        {/* Appel à l'action */}
        <section className="mt-12 rounded-xl border border-blue-600 p-8 text-center">
          <h2 className="text-2xl font-bold">Livrez ce type de rapport à vos clients, dès aujourd’hui</h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-400">
            Collez la transcription de votre prochain rendez-vous : le rapport est prêt en quelques minutes, à votre marque.
            {' '}{ANALYSES_OFFERTES_ESSAI} analyses offertes, sans carte bancaire.
          </p>
          <a href="/signup" className="mt-6 inline-block rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold transition hover:bg-blue-700">
            Essayer gratuitement 🚀
          </a>
        </section>

        <p className="mt-8 text-center text-xs text-gray-400">
          Exemple fictif à but de démonstration. Les estimations d’un vrai rapport reposent sur les informations partagées lors de l’entretien.
        </p>
        <PiedDePageLegal className="mt-8" />
      </div>
    </main>
  )
}
