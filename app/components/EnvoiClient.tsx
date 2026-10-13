'use client'

// Bloc "Envoyer au client" (affiché sous le diagnostic, une fois l'analyse faite).
// 1. Le consultant relit (écran de relecture) puis coche "J'ai relu et validé"   → statut = 'validé'
// 2. Il clique sur "📧 Préparer l'email" → un lien secret unique est créé (valable 30 jours)
//    puis il choisit : sa messagerie, Gmail, ou copier le texte.
// 3. Quand le client ouvre le lien, Supabase note la date et l'heure → affiché ici ("Suivi").

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { chargerProfil, finEmail, PROFIL_DEFAUT, type Profil } from '../lib/profil'

const DUREE_LIEN_JOURS = 30

type InfosPartage = {
  statut: string
  lien_partage: string | null
  expires_at: string | null
  vu_par_client: boolean
  nb_vues: number
  last_viewed_at: string | null
  envoye_at: string | null
  email_client: string | null
}

type EmailPret = { objet: string; corps: string; destinataire: string }

const dateHeure = (iso: string) => {
  const d = new Date(iso)
  return `le ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}`
}

const inputClass =
  'mt-2 w-full rounded-lg border border-gray-500 bg-gray-700 px-4 py-3 text-white placeholder:italic placeholder:text-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400'

const boutonSecondaire =
  'inline-flex items-center gap-2 rounded-lg border border-gray-500 px-4 py-2.5 text-sm font-semibold text-gray-100 transition hover:border-gray-300'

export default function EnvoiClient({ diagnosticId, entreprise }: { diagnosticId: string; entreprise: string }) {
  const [infos, setInfos] = useState<InfosPartage | null>(null)
  const [emailClient, setEmailClient] = useState('')
  const [objet, setObjet] = useState(`Votre Vizion – ${entreprise}`)
  const [message, setMessage] = useState(
    `Bonjour,\n\nSuite à notre entretien, vous trouverez ci-dessous votre diagnostic personnalisé : les points de friction identifiés, les outils recommandés et un plan d'action concret sur 4 jours.\n\nJe reste à votre disposition pour en discuter.\n\nBien cordialement,`,
  )
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [copie, setCopie] = useState<'' | 'lien' | 'email'>('')
  const [emailPret, setEmailPret] = useState<EmailPret | null>(null)
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT) // signature + lien de RDV (page Paramètres)

  // --- Lecture de l'état du partage (statut, lien, suivi des ouvertures) ---
  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('diagnostics')
      .select('statut, lien_partage, expires_at, vu_par_client, nb_vues, last_viewed_at, envoye_at, email_client')
      .eq('id', diagnosticId)
      .single()
    if (error) {
      console.error('[envoi] Lecture impossible :', error)
      setErreur('Impossible de lire l’état du partage.')
      return
    }
    const lu = data as InfosPartage
    setInfos(lu)
    // Pré-remplit l'email du client s'il a déjà été saisi lors d'un envoi précédent
    if (lu.email_client) setEmailClient((e) => e || (lu.email_client as string))
  }, [diagnosticId])

  useEffect(() => {
    charger()
    chargerProfil().then(setProfil)
  }, [charger])

  if (!infos) return null

  const lienValide = Boolean(infos.lien_partage && infos.expires_at && new Date(infos.expires_at) > new Date())
  const url = infos.lien_partage && typeof window !== 'undefined' ? `${window.location.origin}/rapport/${infos.lien_partage}` : ''
  const valide = infos.statut === 'validé' || infos.statut === 'envoyé' || infos.statut === 'clos'
  const surLocalhost = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname)
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClient.trim())

  // --- Étape 1 : validation par le consultant ---
  async function basculerValidation(coche: boolean) {
    setErreur('')
    const nouveau = coche ? 'validé' : 'analysé'
    const { error } = await supabase.from('diagnostics').update({ statut: nouveau }).eq('id', diagnosticId)
    if (error) {
      setErreur('Impossible de changer le statut. Réessayez.')
      return
    }
    setInfos((i) => (i ? { ...i, statut: nouveau } : i))
  }

  // --- Étape 2 : création du lien (si besoin) puis préparation de l'email ---
  async function preparerEmail() {
    setErreur('')
    setEnCours(true)
    try {
      let lien = infos!.lien_partage
      let expiration = infos!.expires_at
      // Nouveau lien si aucun n'existe ou si l'ancien a expiré
      if (!lienValide) {
        lien = crypto.randomUUID() // identifiant aléatoire impossible à deviner
        expiration = new Date(Date.now() + DUREE_LIEN_JOURS * 24 * 60 * 60 * 1000).toISOString()
      }
      const envoyeAt = infos!.envoye_at ?? new Date().toISOString() // date du PREMIER envoi (CA du mois)
      const { error } = await supabase
        .from('diagnostics')
        .update({ lien_partage: lien, expires_at: expiration, statut: 'envoyé', envoye_at: envoyeAt, email_client: emailClient.trim() })
        .eq('id', diagnosticId)
      if (error) throw error

      const lienComplet = `${window.location.origin}/rapport/${lien}`
      const finValidite = new Date(expiration!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      const corps = `${message}\n\n👉 Consulter votre diagnostic : ${lienComplet}\n(lien personnel, valable jusqu'au ${finValidite})${finEmail(profil)}`

      setInfos((i) => (i ? { ...i, lien_partage: lien, expires_at: expiration, statut: 'envoyé', envoye_at: envoyeAt, email_client: emailClient.trim() } : i))
      setEmailPret({ objet, corps, destinataire: emailClient.trim() })
    } catch (e) {
      console.error('[envoi] Échec :', e)
      setErreur('La création du lien a échoué. Vérifiez votre connexion et réessayez.')
    } finally {
      setEnCours(false)
    }
  }

  async function copier(texte: string, quoi: 'lien' | 'email') {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(quoi)
      setTimeout(() => setCopie(''), 2500)
    } catch {
      setErreur('La copie a été bloquée par le navigateur. Sélectionnez le texte à la main.')
    }
  }

  async function desactiverLien() {
    if (!window.confirm('Désactiver le lien ? Votre client ne pourra plus ouvrir le rapport.')) return
    const { error } = await supabase
      .from('diagnostics')
      .update({ lien_partage: null, expires_at: null, statut: 'validé' })
      .eq('id', diagnosticId)
    if (error) {
      setErreur('Impossible de désactiver le lien.')
      return
    }
    setEmailPret(null)
    setInfos((i) => (i ? { ...i, lien_partage: null, expires_at: null, statut: 'validé' } : i))
  }

  const mailto = emailPret
    ? `mailto:${encodeURIComponent(emailPret.destinataire)}?subject=${encodeURIComponent(emailPret.objet)}&body=${encodeURIComponent(emailPret.corps)}`
    : ''
  const gmail = emailPret
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailPret.destinataire)}&su=${encodeURIComponent(emailPret.objet)}&body=${encodeURIComponent(emailPret.corps)}`
    : ''

  return (
    <section className="rounded-xl border border-blue-900 bg-gray-800 p-6">
      <h3 className="text-lg font-semibold">📧 Envoyer au client</h3>

      {erreur && <p role="alert" className="mt-4 rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200">⚠️ {erreur}</p>}

      {/* Étape 1 : relecture + validation obligatoire */}
      <ol className="mt-4 space-y-4">
        <li className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">1</span>
          <span className="text-gray-200">Relisez et personnalisez le diagnostic</span>
          <a href={`/diagnostic/${diagnosticId}/relecture`}
            className="rounded-lg border border-blue-500 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20">
            ✏️ Ouvrir la relecture
          </a>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">2</span>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-blue-500" checked={valide}
              disabled={infos.statut === 'envoyé' || infos.statut === 'clos'}
              onChange={(e) => basculerValidation(e.target.checked)} />
            <span>
              <strong>J’ai relu et validé toutes les recommandations.</strong>
              <span className="block text-gray-400">Le client recevra exactement le rapport affiché ci-dessus.</span>
            </span>
          </label>
        </li>
      </ol>

      {valide && (
        <div className="mt-6 space-y-5 border-t border-gray-700 pt-6">
          {surLocalhost && (
            <p className="rounded-lg border border-yellow-800 bg-yellow-950/40 p-3 text-sm text-yellow-200">
              ⚠️ Le site tourne sur votre ordinateur (localhost) : le lien ne fonctionnera pour votre client qu’une fois le site mis en ligne.
              Vous pouvez quand même tester l’envoi en vous l’adressant à vous-même.
            </p>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium text-gray-200">
              Email du client <span aria-hidden className="text-blue-300">*</span><span className="sr-only">(obligatoire)</span>
              <input className={inputClass} type="email" autoComplete="email" value={emailClient} placeholder="ex. : dirigeant@entreprise.fr"
                aria-describedby="aide-email-client"
                onChange={(e) => { setEmailClient(e.target.value); setEmailPret(null) }} />
              <span id="aide-email-client" className={`mt-1 block text-xs ${emailOk ? 'text-green-400' : 'text-amber-300'}`}>
                {emailOk ? '✓ Adresse valide' : '✍️ Tapez l’adresse email du client pour activer le bouton.'}
              </span>
            </label>
            <label className="block text-sm font-medium text-gray-200">
              Objet
              <input className={inputClass} value={objet} onChange={(e) => { setObjet(e.target.value); setEmailPret(null) }} />
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-200">
            Message personnalisé
            <textarea className={`${inputClass} min-h-40 resize-y text-sm leading-6`} value={message}
              onChange={(e) => { setMessage(e.target.value); setEmailPret(null) }} />
            <span className="mt-1 block text-xs text-gray-400">Le lien du rapport, votre lien de rendez-vous et votre signature (page Paramètres) sont ajoutés automatiquement à la fin.</span>
          </label>

          {!emailPret ? (
            <button type="button" onClick={preparerEmail} disabled={!emailOk || enCours}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              📧 {enCours ? 'Préparation…' : 'Préparer l’email'}
            </button>
          ) : (
            <div className="rounded-lg border border-green-700 bg-green-950/30 p-4" role="status">
              <p className="font-semibold text-green-300">✅ Email prêt ! Comment voulez-vous l’envoyer ?</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a href={mailto} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-blue-700">
                  📧 Ma messagerie (Outlook, Mail…)
                </a>
                <a href={gmail} target="_blank" rel="noopener noreferrer" className={boutonSecondaire}>
                  ✉️ Gmail<span className="sr-only"> (nouvel onglet)</span>
                </a>
                <button type="button" onClick={() => copier(`Objet : ${emailPret.objet}\n\n${emailPret.corps}`, 'email')} className={boutonSecondaire}>
                  {copie === 'email' ? '✅ Copié !' : '📋 Copier le texte'}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-300">Relisez l’email dans votre messagerie, puis cliquez sur « Envoyer ».</p>
            </div>
          )}
        </div>
      )}

      {/* Suivi du lien */}
      {infos.lien_partage && (
        <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">📊 Suivi</p>
            <button type="button" onClick={charger} className="text-xs text-blue-300 hover:underline">↻ Actualiser</button>
          </div>
          <p className="mt-2">
            {infos.vu_par_client && infos.last_viewed_at
              ? <span className="text-green-400">👀 Le client a ouvert le rapport {dateHeure(infos.last_viewed_at)} ({infos.nb_vues} vue{infos.nb_vues > 1 ? 's' : ''})</span>
              : <span className="text-gray-300">⏳ Pas encore ouvert par le client</span>}
          </p>
          <p className="mt-1 text-gray-400">
            {lienValide
              ? `Lien valable jusqu’au ${new Date(infos.expires_at!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : 'Lien expiré : un nouveau lien sera créé au prochain envoi.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => copier(url, 'lien')} className="rounded-lg border border-gray-600 px-3 py-2 text-xs transition hover:border-gray-400">
              {copie === 'lien' ? '✅ Lien copié' : '🔗 Copier le lien'}
            </button>
            <a href={`${url}?apercu=1`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-600 px-3 py-2 text-xs transition hover:border-gray-400">
              👁️ Voir comme le client<span className="sr-only"> (nouvel onglet)</span>
            </a>
            <button type="button" onClick={desactiverLien} className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-red-300 transition hover:border-red-700">
              ⛔ Désactiver le lien
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">Vos aperçus via « Voir comme le client » ne comptent pas comme des ouvertures du client.</p>
        </div>
      )}
    </section>
  )
}
