'use client'

// La CLOCHE 🔔 des notifications (en haut à droite du tableau de bord).
//  - Badge rouge = nombre de notifications non lues
//  - Clic = liste des dernières notifications (Succès vert, Erreur rouge, Info bleu)
//  - Clic sur une notification = elle est marquée lue et sa page s'ouvre
//  - « Tout marquer comme lu »
// Mise à jour en direct (temps réel Supabase), et de secours toutes les 60 secondes.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  chargerNotifications, depuisQuand, EVENEMENT_NOTIFICATION, marquerCommeLue, STYLE_NOTIFICATION,
  toutMarquerCommeLu, type Notification,
} from '../lib/notifications'

export default function NotificationBell() {
  const [ouvert, setOuvert] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [nonLues, setNonLues] = useState(0)
  const [indisponible, setIndisponible] = useState(false)
  const [secoue, setSecoue] = useState(false) // petite animation quand une notification arrive
  const [maintenant, setMaintenant] = useState(() => Date.now())
  const conteneurRef = useRef<HTMLDivElement>(null)
  const boutonRef = useRef<HTMLButtonElement>(null)
  const nonLuesRef = useRef(0)

  // --- Chargement ---
  const recharger = useCallback(async () => {
    const r = await chargerNotifications()
    setIndisponible(r.indisponible)
    setNotifications(r.liste)
    setNonLues(r.nonLues)
    setMaintenant(Date.now())
    // Une nouvelle notification non lue est arrivée : la cloche bouge un instant
    if (r.nonLues > nonLuesRef.current) {
      setSecoue(true)
      setTimeout(() => setSecoue(false), 1200)
    }
    nonLuesRef.current = r.nonLues
  }, [])

  useEffect(() => {
    let canal: ReturnType<typeof supabase.channel> | null = null
    let actif = true

    async function demarrer() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !actif) return
      await recharger()
      // Temps réel : Supabase nous prévient dès qu'une notification est créée pour nous
      canal = supabase
        .channel(`notifications-${session.user.id}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          () => { recharger() })
        .subscribe()
    }
    demarrer()

    // Secours : toutes les 60 s, au retour sur l'onglet, et quand sendNotification() est appelée
    const minuterie = setInterval(recharger, 60_000)
    const surFocus = () => { recharger() }
    window.addEventListener('focus', surFocus)
    window.addEventListener(EVENEMENT_NOTIFICATION, surFocus)

    return () => {
      actif = false
      clearInterval(minuterie)
      window.removeEventListener('focus', surFocus)
      window.removeEventListener(EVENEMENT_NOTIFICATION, surFocus)
      if (canal) supabase.removeChannel(canal)
    }
  }, [recharger])

  // --- Fermer en cliquant à côté, ou avec la touche Échap ---
  useEffect(() => {
    if (!ouvert) return
    function clicAilleurs(e: MouseEvent) {
      if (!conteneurRef.current?.contains(e.target as Node)) setOuvert(false)
    }
    function clavier(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOuvert(false)
        boutonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', clicAilleurs)
    document.addEventListener('keydown', clavier)
    return () => {
      document.removeEventListener('mousedown', clicAilleurs)
      document.removeEventListener('keydown', clavier)
    }
  }, [ouvert])

  function basculer() {
    if (!ouvert) {
      setMaintenant(Date.now())
      recharger()
    }
    setOuvert((o) => !o)
  }

  // --- Actions ---
  async function marquerLue(n: Notification) {
    if (n.lue) return
    // Affichage immédiat, puis enregistrement
    setNotifications((liste) => liste.map((x) => (x.id === n.id ? { ...x, lue: true } : x)))
    setNonLues((c) => Math.max(0, c - 1))
    nonLuesRef.current = Math.max(0, nonLuesRef.current - 1)
    const ok = await marquerCommeLue(n.id)
    if (!ok) recharger()
  }

  async function ouvrirNotification(n: Notification) {
    await marquerLue(n)
    if (n.lien) {
      setOuvert(false)
      window.location.href = n.lien
    }
  }

  async function toutMarquer() {
    setNotifications((liste) => liste.map((x) => ({ ...x, lue: true })))
    setNonLues(0)
    nonLuesRef.current = 0
    const ok = await toutMarquerCommeLu()
    if (!ok) recharger()
  }

  const libelleBouton = nonLues > 0
    ? `Notifications : ${nonLues} non lue${nonLues > 1 ? 's' : ''}`
    : 'Notifications : aucune nouvelle'

  return (
    <div ref={conteneurRef} className="relative">
      <button ref={boutonRef} type="button" onClick={basculer}
        aria-label={libelleBouton} aria-expanded={ouvert} aria-controls="panneau-notifications" aria-haspopup="true"
        className={`relative flex h-12 w-12 items-center justify-center rounded-lg border text-xl transition
          ${ouvert ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-400'}`}>
        <span aria-hidden className={secoue ? 'inline-block animate-bounce' : 'inline-block'}>🔔</span>
        {nonLues > 0 && (
          <span aria-hidden
            className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-gray-900 bg-red-600 px-1.5 text-xs font-bold text-white">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>
      {/* Annonce pour les lecteurs d'écran quand le nombre change */}
      <span className="sr-only" aria-live="polite">{nonLues > 0 ? `${nonLues} notification${nonLues > 1 ? 's' : ''} non lue${nonLues > 1 ? 's' : ''}` : ''}</span>

      {ouvert && (
        <div id="panneau-notifications" role="dialog" aria-label="Notifications"
          className="fixed left-4 right-4 top-20 z-40 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          {/* En-tête */}
          <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
            <p className="font-semibold">
              Notifications
              {nonLues > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold">{nonLues}</span>}
            </p>
            <button type="button" onClick={toutMarquer} disabled={nonLues === 0}
              className="text-xs font-medium text-blue-300 transition hover:text-blue-200 hover:underline disabled:cursor-not-allowed disabled:text-gray-500 disabled:no-underline">
              Tout marquer comme lu
            </button>
          </div>

          {/* Liste */}
          {indisponible ? (
            <p className="px-4 py-6 text-sm text-amber-200">
              ⚙️ Les notifications ne sont pas encore installées : exécutez <code className="font-mono">supabase/09_notifications.sql</code> dans Supabase.
            </p>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-3xl" aria-hidden>🔕</p>
              <p className="mt-2 text-sm text-gray-400">Aucune notification pour l’instant.</p>
            </div>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-gray-800 overflow-y-auto">
              {notifications.map((n) => {
                const style = STYLE_NOTIFICATION[n.type] ?? STYLE_NOTIFICATION.info
                return (
                  <li key={n.id} className={`flex items-start gap-2 border-l-4 ${style.bord} ${n.lue ? 'bg-transparent' : 'bg-gray-800/70'}`}>
                    <button type="button" onClick={() => ouvrirNotification(n)}
                      className="flex min-w-0 flex-1 gap-3 px-3 py-3 text-left transition hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400">
                      <span aria-hidden className="text-lg leading-6">{style.icone}</span>
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">{style.libelle}{n.lue ? '' : ', non lue'} : </span>
                        <span className={`block text-sm ${n.lue ? 'text-gray-300' : 'font-semibold text-white'}`}>{n.titre}</span>
                        {n.message && <span className="mt-0.5 block text-xs text-gray-400">{n.message}</span>}
                        <span className="mt-1 block text-[11px] text-gray-500">
                          {depuisQuand(n.created_at, maintenant)}{n.lien && ' · ouvrir →'}
                        </span>
                      </span>
                    </button>
                    {!n.lue && (
                      <button type="button" onClick={() => marquerLue(n)} title="Marquer comme lue"
                        aria-label={`Marquer comme lue : ${n.titre}`}
                        className="m-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs text-gray-400 transition hover:bg-gray-700 hover:text-white">
                        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${style.pastille}`} />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
