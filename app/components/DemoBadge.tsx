'use client'

// Bandeau « MODE DÉMO » affiché en haut des pages de l'ESPACE DE TRAVAIL quand le mode démo est actif
// (tableau de bord, diagnostics, paramètres). Il n'apparaît PAS sur le site public (accueil, /exemple,
// connexion, CGV…) ni sur le rapport envoyé au client : là, il ne voudrait rien dire.
// Il est placé une seule fois dans app/layout.tsx. Invisible à l'impression (PDF).

import { usePathname } from 'next/navigation'
import { changerModeDemo, useModeDemo } from '../lib/mode-demo'

const PAGES_ESPACE = ['/dashboard', '/diagnostic']
const dansEspace = (chemin: string) => PAGES_ESPACE.some((p) => chemin === p || chemin.startsWith(`${p}/`))

export default function DemoBadge() {
  const modeDemo = useModeDemo()
  const chemin = usePathname() ?? ''
  if (!modeDemo || !dansEspace(chemin)) return null

  return (
    <div role="note" aria-label="Mode démo actif"
      className="sticky top-0 z-30 border-b border-purple-500/60 bg-purple-950/95 px-4 py-2 text-sm text-purple-100 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-between">
        <p className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-purple-500 px-2 py-0.5 text-xs font-bold tracking-wider text-white">🧪 MODE DÉMO</span>
          <span>L’analyse IA est simulée : données fictives, aucun crédit utilisé.</span>
        </p>
        <div className="flex items-center gap-3">
          <a href="/dashboard/settings#mode-demo" className="text-purple-200 underline-offset-2 hover:underline">Réglages</a>
          <button type="button" onClick={() => changerModeDemo(false)}
            className="rounded-md border border-purple-400 px-3 py-1 text-xs font-semibold transition hover:bg-purple-500/30">
            Désactiver
          </button>
        </div>
      </div>
    </div>
  )
}
