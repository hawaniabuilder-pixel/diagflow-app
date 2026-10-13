// Mise en page commune aux pages légales (mentions légales, CGU/CGV, confidentialité).
import PiedDePageLegal from './PiedDePageLegal'
import { A_COMPLETER, ENTREPRISE } from '../lib/entreprise'

// Une section avec un titre
export function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
      <h2 className="text-xl font-semibold">{titre}</h2>
      <div className="mt-3 space-y-3 leading-7 text-gray-300">{children}</div>
    </section>
  )
}

// Affiche une valeur de lib/entreprise.ts : en JAUNE tant qu'elle n'est pas remplie
export function Info({ valeur, siVide }: { valeur: string; siVide?: string }) {
  if (!valeur) return siVide ? <>{siVide}</> : null
  if (valeur.startsWith(A_COMPLETER)) {
    return <span className="rounded bg-yellow-900/60 px-1.5 py-0.5 text-yellow-200">{valeur}</span>
  }
  return <>{valeur}</>
}

export default function PageLegale({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 pt-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-center justify-between border-b border-gray-800 pb-6">
          <a href="/" className="text-lg font-bold text-blue-400">{ENTREPRISE.nomCommercial}</a>
          <a href="/dashboard" className="text-sm text-gray-400 transition hover:text-white">Tableau de bord →</a>
        </header>

        <h1 className="text-3xl font-bold sm:text-4xl">{titre}</h1>
        <p className="mt-3 text-gray-400">Dernière mise à jour : <Info valeur={ENTREPRISE.dateMiseAJour} /></p>

        <div className="mt-8 space-y-6">{children}</div>

        <PiedDePageLegal className="mt-12" />
      </div>
    </main>
  )
}
