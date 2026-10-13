'use client'

// 🚀 BIEN DÉMARRER : petite liste des 4 premières choses à faire, dans le tableau de bord.
// Elle disparaît toute seule quand tout est fait, ou quand on clique sur « Masquer ».
// Le choix « Masquer » est gardé dans ce navigateur (localStorage).
import { useSyncExternalStore } from 'react'

const CLE = 'diagflow_guide_masque'
const EVENEMENT = 'diagflow-guide-change'

function lireMasque(): boolean {
  try {
    return localStorage.getItem(CLE) === 'true'
  } catch {
    return false
  }
}

function sAbonner(prevenir: () => void) {
  window.addEventListener(EVENEMENT, prevenir)
  window.addEventListener('storage', prevenir)
  return () => {
    window.removeEventListener(EVENEMENT, prevenir)
    window.removeEventListener('storage', prevenir)
  }
}

function masquer() {
  try {
    localStorage.setItem(CLE, 'true')
  } catch {
    // stockage bloqué : le guide reviendra au prochain chargement
  }
  window.dispatchEvent(new Event(EVENEMENT))
}

export type EtapeGuide = {
  fait: boolean
  titre: string
  detail: string
  lien: string
  bouton: string
}

export default function GuideDemarrage({ etapes }: { etapes: EtapeGuide[] }) {
  // Côté serveur : on considère le guide masqué (il apparaît une fois la page chargée)
  const masque = useSyncExternalStore(sAbonner, lireMasque, () => true)
  const faites = etapes.filter((e) => e.fait).length
  if (masque || faites === etapes.length) return null
  const prochaine = etapes.find((e) => !e.fait)

  return (
    <section aria-labelledby="titre-guide" className="mt-6 rounded-xl border border-blue-800/70 bg-blue-950/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titre-guide" className="text-lg font-semibold">🚀 Bien démarrer</h2>
          <p className="mt-1 text-sm text-gray-300">{faites} étape{faites > 1 ? 's' : ''} sur {etapes.length} · environ 15 minutes au total</p>
        </div>
        <button type="button" onClick={masquer} className="text-sm text-gray-400 underline transition hover:text-white">
          Masquer
        </button>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-700" aria-hidden>
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(faites / etapes.length) * 100}%` }} />
      </div>

      <ol className="mt-4 grid gap-3 md:grid-cols-2">
        {etapes.map((e, i) => (
          <li key={e.titre}
            className={`flex items-start gap-3 rounded-lg p-3 ${e === prochaine ? 'border border-blue-500 bg-gray-900/70' : 'bg-gray-900/40'}`}>
            <span aria-hidden className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${e.fait ? 'bg-green-600' : 'bg-gray-700'}`}>
              {e.fait ? '✓' : i + 1}
            </span>
            <div className="min-w-0">
              <p className={`font-medium ${e.fait ? 'text-gray-400 line-through' : ''}`}>
                {e.titre}<span className="sr-only">{e.fait ? ' (fait)' : ' (à faire)'}</span>
              </p>
              {!e.fait && (
                <>
                  <p className="mt-0.5 text-xs text-gray-400">{e.detail}</p>
                  <a href={e.lien} className="mt-2 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold transition hover:bg-blue-700">
                    {e.bouton}
                  </a>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
