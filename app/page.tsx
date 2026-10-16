//vizionPAGEvizionD'ACCUEIL (publique) : présenter l'outil, les tarifs, et donner envie de s'inscrire.
// ✏️ Les prix se règlent dans app/lib/entreprise.ts (offre Solo, offre Équipe)
//    et app/lib/templates.ts (prix conseillés des rapports Express / Complet / Premium).
import type { Metadata } from 'next'
import PiedDePageLegal from './components/PiedDePageLegal'
import { TEMPLATE_IDS, TEMPLATES } from './lib/templates'
import { SECTEURS } from './lib/diagnostic-schema'
import {
  ANALYSES_IA_INCLUSES,
  ANALYSES_OFFERTES_ESSAI,
  ENTREPRISE,
  JOURS_ESSAI,
  TARIF_SOLO_ANNUEL,
  PLACES_OFFRE_EQUIPE,
  PRIX_OFFRE_EQUIPE,
  TARIF_SOLO_MENSUEL,
} from './lib/entreprise'

export const metadata: Metadata = {
  title: 'vizion — De l’entretien au rapport à votre marque, prêt le jour même',
  description:
    'Pour les consultants, experts-comptables et coachs : transformez un entretien avec un dirigeant de PME en rapport chiffré et plan d’action. Partout en France.',
}

// « Pourquoi pas une IA généraliste ? » : la comparaison avec le bricolage (notes de réunion + IA généraliste).
// Pas de nom de marque : une publicité comparative doit rester objective et vérifiable.
const COMPARAISON = [
  { critere: 'Prix par consultant', bricolage: 'Environ 40 à 70 € par mois (2 abonnements)', vizion: `${TARIF_SOLO_MENSUEL ?? '—'} € par mois en Solo, environ 20 € en équipe` },
  { critere: 'Rapport pour une PME', bricolage: 'À redemander et remettre en page à chaque fois', vizion: 'Même structure à chaque fois, 3 formats prêts à vendre' },
  { critere: 'Temps et argent gagnés', bricolage: 'Estimés par l’IA, à vérifier un par un', vizion: 'Calculés par le logiciel à partir de votre taux horaire' },
  { critere: 'Votre image', bricolage: 'Logo et couleurs à ajouter à la main', vizion: 'Rapport à votre logo et à vos couleurs' },
  { critere: 'Contenu français', bricolage: 'Conseils génériques', vizion: 'Outils utilisés par les PME françaises, points RGPD, toutes les régions' },
  { critere: 'Après l’envoi', bricolage: 'Rien : relances à la main', vizion: 'Lien suivi, relances à J+3, J+7, J+14, missions signées' },
]

// Les 3 étapes du parcours (pas de faux témoignages : en France, publier de faux avis est une pratique commerciale trompeuse)
const ETAPES = [
  { numero: '1', titre: 'Saisissez l’entretien', texte: 'Collez ou importez la transcription de votre entretien avec le dirigeant (fichier .txt, .docx ou .pdf).' },
  { numero: '2', titre: 'L’IA analyse', texte: 'Points de friction, outils adaptés aux PME françaises, quick wins et impact financier chiffré.' },
  { numero: '3', titre: 'Vous relisez et livrez', texte: 'Vous gardez la main : vous validez et personnalisez chaque recommandation avant de l’envoyer au client.' },
]

const ATOUTS = [
  { titre: '⚡ Rapide', texte: 'Un diagnostic structuré en quelques minutes, au lieu de plusieurs heures de rédaction.' },
  { titre: '🇫🇷 Pensé pour la France', texte: `${SECTEURS.length - 1} secteurs, des outils utilisés par les PME françaises, les points RGPD, en métropole comme en outre-mer.` },
  { titre: '📊 Professionnel', texte: 'Rapport à votre logo, lien sécurisé pour le client, et vous voyez quand il l’ouvre.' },
  { titre: '💶 Chiffré', texte: 'Temps perdu et gains estimés en euros : un argument clair pour signer la mission suivante.' },
]

const PUBLIC = [
  { emoji: '💼', titre: 'Consultants', texte: 'Indépendants ou en cabinet' },
  { emoji: '📈', titre: 'Experts-comptables', texte: 'Pour vos clients PME' },
  { emoji: '🧭', titre: 'Coachs business', texte: 'Accompagnement personnalisé' },
  { emoji: '💡', titre: 'Entrepreneurs', texte: 'Auto-entrepreneurs du conseil' },
]

const QUESTIONS = [
  {
    q: 'Faut-il s’y connaître en intelligence artificielle ?',
    r: `Non. Vous collez votre entretien, vous choisissez le format du rapport, et l’outil fait le reste. ${ANALYSES_OFFERTES_ESSAI} vraies analyses sont offertes à l’inscription, et le mode démo est illimité.`,
  },
  {
    q: 'Est-ce que je peux modifier le rapport ?',
    r: 'Oui, et c’est même prévu : chaque rapport passe par une étape de relecture où vous corrigez, ajoutez ou supprimez ce que vous voulez avant l’envoi.',
  },
  {
    q: 'Les données de mes clients sont-elles protégées ?',
    r: 'Chaque consultant ne voit que ses propres diagnostics (règle appliquée par la base de données). Les données ne sont pas revendues, et vous pouvez tout télécharger ou tout supprimer à tout moment.',
  },
  {
    q: 'Ça marche pour des entreprises hors de Paris ?',
    r: 'Oui : partout en France, métropole et outre-mer. La ville et la région de l’entreprise sont prises en compte dans l’analyse.',
  },
]

const carte = 'rounded-xl border border-gray-700 bg-gray-800 p-6'

export default function Home() {
  const soloAnnonce = TARIF_SOLO_MENSUEL != null

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
            {/* --- BANDEAU HAUT PME --- */}
      <div className="w-full bg-coral/10 border-b border-coral/30 py-2 px-4 text-center">
        <p className="text-sm font-medium text-orange-200 flex items-center justify-center gap-2 flex-wrap">
          <span>🚀 Nouveauté :</span> 
          <a href="/accompagnement" className="underline decoration-dotted underline-offset-4 hover:text-white transition-colors font-bold whitespace-nowrap">
            Audit Flash Direct pour Dirigeants PME (48h) →
          </a>
        </p>
      </div>
      {/* En-tête */}
      <header className="container mx-auto px-6 py-6">
        <nav className="flex flex-wrap items-center justify-between gap-4" aria-label="Navigation principale">
          <a href="/" className="text-2xl font-bold text-blue-400">{ENTREPRISE.nomCommercial}</a>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="#tarifs" className="text-gray-300 transition hover:text-white">Tarifs</a>
            <a href="/login" className="text-gray-300 transition hover:text-white">Connexion</a>
            <a href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 font-semibold transition hover:bg-blue-700">S’inscrire</a>
          </div>
        </nav>
      </header>

      {/* Section principale */}
      <main>
        <section className="container mx-auto px-6 py-20 text-center">
          <p className="mb-4 inline-block rounded-full border border-blue-800 bg-blue-950/50 px-4 py-1 text-sm text-blue-200">
            Pour les consultants qui accompagnent des PME, partout en France
          </p>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">
            De l’entretien au rapport à votre marque, prêt le jour même
          </h1>
          <p className="mx-auto mb-8 mt-6 max-w-2xl text-xl text-gray-400">
            Collez la transcription de votre rendez-vous avec un dirigeant de PME : vous obtenez un diagnostic chiffré
            (outils adaptés, plan d’action, gains en euros). Vous le relisez, l’envoyez, et vous suivez le client jusqu’à la mission signée.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/signup" className="inline-block rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold transition hover:scale-105 hover:bg-blue-700">
              Essayer gratuitement 🚀
            </a>
            <a href="/exemple" className="inline-block rounded-lg border border-gray-600 px-8 py-4 text-lg font-semibold text-gray-200 transition hover:border-gray-400 hover:text-white">
              Voir un exemple de rapport
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-400">{ANALYSES_OFFERTES_ESSAI} analyses IA offertes, sans carte bancaire · mode démo illimité · <a href="#tarifs" className="underline hover:text-white">voir les tarifs</a></p>
        </section>

        {/* Atouts */}
        <section className="container mx-auto px-6 py-12" aria-label="Les atouts">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {ATOUTS.map((a) => (
              <div key={a.titre} className={carte}>
                <h2 className="mb-3 text-xl font-bold">{a.titre}</h2>
                <p className="text-gray-400">{a.texte}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="bg-gray-800/30 py-20">
          <div className="container mx-auto px-6">
            <h2 className="mb-12 text-center text-3xl font-bold">Comment ça marche</h2>
            <div className="grid gap-8 md:grid-cols-3">
              {ETAPES.map((e) => (
                <div key={e.numero} className={carte}>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold">{e.numero}</div>
                  <h3 className="mb-2 text-xl font-bold">{e.titre}</h3>
                  <p className="text-gray-400">{e.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pourquoi pas une IA généraliste ? */}
        <section className="container mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold">Pourquoi pas simplement une IA généraliste ?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-400">
            Beaucoup de consultants enregistrent le rendez-vous, puis demandent le rapport à une IA. Ça marche, mais tout reste à faire après.
          </p>
          <div className="mt-10 overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Comparaison entre un outil de notes avec une IA généraliste, et vizion</caption>
              <thead className="bg-gray-800 text-gray-300">
                <tr>
                  <th scope="col" className="px-5 py-4 font-semibold"> </th>
                  <th scope="col" className="px-5 py-4 font-semibold">Notes de réunion + IA généraliste</th>
                  <th scope="col" className="px-5 py-4 font-semibold text-blue-300">{ENTREPRISE.nomCommercial}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {COMPARAISON.map((c) => (
                  <tr key={c.critere}>
                    <th scope="row" className="px-5 py-4 font-medium text-gray-200">{c.critere}</th>
                    <td className="px-5 py-4 text-gray-400">{c.bricolage}</td>
                    <td className="px-5 py-4 text-white">✓ {c.vizion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ce que le consultant vend à ses clients */}
        <section className="container mx-auto px-6 py-20">
          <h2 className="text-center text-3xl font-bold">3 formats de rapport à vendre à vos clients</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-400">
            Vous fixez votre prix. Voici nos prix conseillés, que vous pouvez modifier pour chaque client.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TEMPLATE_IDS.map((id) => {
              const t = TEMPLATES[id]
              return (
                <div key={id} className={`relative rounded-xl border p-6 ${t.recommande ? 'border-blue-500 bg-blue-950/30' : 'border-gray-700 bg-gray-800'}`}>
                  {t.recommande && (
                    <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold">Recommandé</span>
                  )}
                  <p className="text-lg font-bold">{t.emoji} {t.nom}</p>
                  <p className="mt-1 text-sm text-gray-400">{t.pages} page{t.pages > 1 ? 's' : ''} · {t.slogan}</p>
                  <p className="mt-4 text-3xl font-bold">{t.prix} €<span className="text-base font-medium text-gray-400"> HT conseillé</span></p>
                  <ul className="mt-4 space-y-1.5 text-sm text-gray-300">
                    {t.contenu.map((c) => <li key={c}>✓ {c}</li>)}
                  </ul>
                  <p className="mt-4 text-xs text-gray-400">Idéal pour : {t.pourQui.toLowerCase()}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Tarifs de l'outil */}
        <section id="tarifs" className="scroll-mt-8 bg-gray-800/30 py-20">
          <div className="container mx-auto px-6">
            <h2 className="text-center text-3xl font-bold">Tarifs</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-gray-400">Sans engagement. Prix hors taxes.</p>
            <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
              {/* Solo */}
              <div className={carte}>
                <p className="text-lg font-bold">💼 Solo</p>
                <p className="mt-1 text-sm text-gray-400">Pour un consultant indépendant</p>
                <p className="mt-4 text-3xl font-bold">
                  {soloAnnonce ? <>{TARIF_SOLO_MENSUEL} €<span className="text-base font-medium text-gray-400"> / mois</span></> : <span className="text-2xl">Tarif communiqué au lancement</span>}
                </p>
                {soloAnnonce && TARIF_SOLO_ANNUEL != null && (
                  <p className="text-sm text-gray-400">ou {TARIF_SOLO_ANNUEL} € par an (2 mois offerts)</p>
                )}
                <ul className="mt-5 space-y-2 text-sm text-gray-300">
                  <li>✓ {ANALYSES_IA_INCLUSES} analyses IA par mois</li>
                  <li>✓ Les 3 formats : Express, Complet, Premium</li>
                  <li>✓ Rapport à votre logo + lien sécurisé pour le client</li>
                  <li>✓ Relances et suivi des missions signées</li>
                  <li>✓ Mode démo illimité</li>
                </ul>
                <a href="/signup" className="mt-6 block rounded-lg bg-blue-600 py-3 text-center font-semibold transition hover:bg-blue-700">
                  Commencer : {ANALYSES_OFFERTES_ESSAI} analyses offertes
                </a>
                <p className="mt-2 text-center text-xs text-gray-400">Sans carte bancaire · <a href="/exemple" className="underline hover:text-white">voir un exemple de rapport</a></p>
              </div>

              {/* Équipe */}
              <div className="relative rounded-xl border border-purple-500 bg-purple-950/30 p-6">
                <span className="absolute -top-3 left-6 rounded-full bg-purple-600 px-3 py-0.5 text-xs font-semibold">{JOURS_ESSAI} jours d’essai gratuit</span>
                <p className="text-lg font-bold">👥 Équipe</p>
                <p className="mt-1 text-sm text-gray-400">Pour un cabinet</p>
                <p className="mt-4 text-3xl font-bold">{PRIX_OFFRE_EQUIPE} €<span className="text-base font-medium text-gray-400"> / mois</span></p>
                <p className="text-sm text-gray-400">pour {PLACES_OFFRE_EQUIPE} consultants, soit {Math.round((PRIX_OFFRE_EQUIPE / PLACES_OFFRE_EQUIPE) * 10) / 10} € par personne</p>
                <ul className="mt-5 space-y-2 text-sm text-gray-300">
                  <li>✓ Tout le Solo, pour chaque consultant</li>
                  <li>✓ Rôles Admin, Consultant et Viewer</li>
                  <li>✓ Viewers gratuits (lecture seule)</li>
                  <li>✓ Partage des diagnostics dans l’équipe</li>
                 <li>✓ Essai sans carte bancaire ({ANALYSES_OFFERTES_ESSAI} analyses IA offertes par personne)</li>
                </ul>
                <a href="/signup?suite=%2Fdashboard%2Fequipe" className="mt-6 block rounded-lg bg-purple-600 py-3 text-center font-semibold transition hover:bg-purple-700">
                  Démarrer l’essai Équipe
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Pour qui */}
        <section className="container mx-auto px-6 py-20">
          <h2 className="mb-12 text-center text-3xl font-bold">Parfait pour :</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PUBLIC.map((p) => (
              <div key={p.titre} className={`${carte} text-center`}>
                <div className="mb-4 text-4xl" aria-hidden>{p.emoji}</div>
                <h3 className="mb-2 font-bold">{p.titre}</h3>
                <p className="text-sm text-gray-400">{p.texte}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Questions fréquentes */}
        <section className="container mx-auto max-w-3xl px-6 pb-20">
          <h2 className="mb-8 text-center text-3xl font-bold">Questions fréquentes</h2>
          <div className="space-y-3">
            {QUESTIONS.map((x) => (
              <details key={x.q} className="group rounded-xl border border-gray-700 bg-gray-800 p-5">
                <summary className="cursor-pointer list-none font-semibold">
                  <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden>›</span>{x.q}
                </summary>
                <p className="mt-3 text-gray-300">{x.r}</p>
              </details>
            ))}
          </div>
          <div className="mt-12 text-center">
            <a href="/signup" className="inline-block rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold transition hover:bg-blue-700">
              Essayer gratuitement 🚀
            </a>
          </div>
        </section>
              
      {/* --- PONT VERS OFFRES PME (Discret mais Efficace) --- */}
      <div className="mt-20 py-10 border-t border-gray-800 text-center bg-gray-900/50 rounded-xl mx-4 md:mx-auto max-w-4xl mb-12">
        <p className="text-gray-400 mb-4 text-sm uppercase tracking-wider font-semibold">
          Vous êtes dirigeant de PME ? Pas de temps à perdre ?
        </p>
        <h3 className="text-2xl font-bold text-white mb-6">
          Obtenez votre diagnostic stratégique en 48h chrono.
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a 
            href="https://buy.stripe.com/TON_VRAI_LIEN_ICI" 
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg bg-coral/10 border border-coral/50 text-coral font-bold hover:bg-coral hover:text-white transition-all shadow-lg inline-block"
          >
            Voir les Audits Flash (149€ / 299€) →
          </a>
        </div>
        <p className="text-xs text-gray-500 mt-4 italic">
          Réalisé et relu personnellement par notre fondateur. Slots limités.
        </p>
      </div>
      </main>

      <div className="container mx-auto px-6">
        <PiedDePageLegal />
      </div>
    </div>
  )
}
