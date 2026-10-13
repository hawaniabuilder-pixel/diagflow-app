'use client'

// Page ÉQUIPE : créer son équipe, inviter des consultants, gérer les rôles.
// Adresse : /dashboard/equipe
// Offre : 99 €/mois pour 5 places (Admin + Consultants), Viewers gratuits, essai de 14 jours
// (pendant l'essai, chacun garde ses 3 analyses IA offertes ; 30 par mois une fois la licence payée).
// La sécurité (qui a le droit de faire quoi) est vérifiée par Supabase (supabase/07_equipes.sql).
// Paiement : Stripe (supabase/11_paiement_stripe.sql + app/api/stripe/…).

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { chargerProfil, finEmail, PROFIL_DEFAUT, type Profil } from '../../lib/profil'
import { lienMailto } from '../../lib/relances'
import { ANALYSES_IA_INCLUSES, ANALYSES_OFFERTES_ESSAI } from '../../lib/entreprise'
import {
  chargerInvitations, chargerMembres, chargerMonEquipe, emailInvitation, etatLicence, infoRole, joursRestants,
  JOURS_ESSAI, lienDemandeActivation, lienInvitation, messageErreurEquipe, PLACES_OFFRE_EQUIPE, PRIX_OFFRE_EQUIPE,
  ROLES, type Invitation, type Membre, type ResumeEquipe, type Role,
} from '../../lib/equipe'
import {
  abonnementEnCours, actualiserAbonnement, chargerAbonnement, ouvrirEspaceClient, payerOffreEquipe, texteAbonnement,
  type Abonnement,
} from '../../lib/paiement'

const inputClass =
  'mt-2 w-full rounded-lg border border-gray-500 bg-gray-700 px-4 py-3 text-white placeholder:italic placeholder:text-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400'
const boutonSecondaire =
  'rounded-lg border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:border-gray-400 hover:text-white disabled:opacity-50'

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type InvitationPrete = { email: string; role: Role; lien: string; objet: string; corps: string }

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
}

function BadgeRole({ role }: { role: Role }) {
  const r = infoRole(role)
  const couleur = role === 'admin' ? 'bg-amber-900/60 text-amber-200' : role === 'consultant' ? 'bg-blue-900/60 text-blue-200' : 'bg-gray-700 text-gray-200'
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${couleur}`}><span aria-hidden>{r.emoji}</span>{r.libelle}</span>
}

export default function EquipePage() {
  const router = useRouter()
  const [chargement, setChargement] = useState(true)
  const [indisponible, setIndisponible] = useState(false)
  const [equipe, setEquipe] = useState<ResumeEquipe | null>(null)
  const [membres, setMembres] = useState<Membre[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [profil, setProfil] = useState<Profil>(PROFIL_DEFAUT)
  const [erreur, setErreur] = useState('')
  const [info, setInfo] = useState('')
  const [enCours, setEnCours] = useState<string | null>(null) // quelle action est en cours

  // Formulaires
  const [nomEquipe, setNomEquipe] = useState('')
  const [emailInvite, setEmailInvite] = useState('')
  const [roleInvite, setRoleInvite] = useState<Role>('consultant')
  const [invitationPrete, setInvitationPrete] = useState<InvitationPrete | null>(null)
  const [copie, setCopie] = useState<'lien' | 'texte' | null>(null)
  const [renommage, setRenommage] = useState<string | null>(null) // null = pas en train de renommer

  // Paiement Stripe (Admin)
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null)
  const [paiement, setPaiement] = useState<'payer' | 'portail' | 'actualiser' | null>(null)
  const [secoursEmail, setSecoursEmail] = useState(false) // Stripe pas encore configuré : on propose l'email

  // --- Chargement ---
  const recharger = useCallback(async () => {
    const resultat = await chargerMonEquipe()
    setIndisponible(resultat.indisponible)
    if (resultat.erreur) setErreur('Impossible de charger votre équipe. Vérifiez votre connexion puis rechargez la page.')
    setEquipe(resultat.equipe)
    if (resultat.equipe) {
      const [m, inv] = await Promise.all([
        chargerMembres(),
        resultat.equipe.mon_role === 'admin' ? chargerInvitations() : Promise.resolve([]),
      ])
      setMembres(m)
      setInvitations(inv)
    } else {
      setMembres([])
      setInvitations([])
    }
    setChargement(false)
    return resultat.equipe
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login?suite=%2Fdashboard%2Fequipe')
        return
      }
      chargerProfil().then(setProfil)
      const e = await recharger()
      if (e?.mon_role !== 'admin') return

      // Retour de Stripe : ?paiement=reussi / annule / portail
      const retour = new URLSearchParams(window.location.search).get('paiement')
      if (retour) window.history.replaceState(null, '', '/dashboard/equipe')
      if (retour === 'annule') {
        setInfo('Paiement annulé : rien n’a été prélevé.')
      }
      if (retour === 'reussi' || retour === 'portail') {
        // On relit tout de suite l'abonnement chez Stripe (sans attendre le webhook)
        if (retour === 'reussi') setInfo('⏳ Vérification du paiement auprès de Stripe…')
        setPaiement('actualiser')
        const { abonnement: a, erreur: probleme } = await actualiserAbonnement()
        setPaiement(null)
        setAbonnement(a)
        if (probleme) {
          setInfo('')
          setErreur(probleme)
        } else if (retour === 'reussi') {
          setInfo('🎉 Merci ! Votre abonnement Équipe est enregistré.')
        }
        await recharger()
        return
      }
      setAbonnement(await chargerAbonnement())
    }
    init()
  }, [router, recharger])

  // --- Paiement Stripe ---
  async function payer() {
    setErreur('')
    setInfo('')
    setPaiement('payer')
    const probleme = await payerOffreEquipe() // part vers Stripe si tout va bien
    if (probleme) {
      setPaiement(null)
      setErreur(probleme)
      setSecoursEmail(/pas encore configuré|pas encore installé/.test(probleme))
    }
  }

  async function gererAbonnement() {
    setErreur('')
    setPaiement('portail')
    const probleme = await ouvrirEspaceClient()
    if (probleme) {
      setPaiement(null)
      setErreur(probleme)
    }
  }

  async function actualiser() {
    setErreur('')
    setInfo('')
    setPaiement('actualiser')
    const { abonnement: a, erreur: probleme } = await actualiserAbonnement()
    setPaiement(null)
    if (probleme) {
      setErreur(probleme)
      return
    }
    setAbonnement(a)
    setInfo('🔄 Abonnement actualisé.')
    await recharger()
  }

  // Petit utilitaire : lance une action Supabase, affiche l'erreur éventuelle, recharge
  async function action(cle: string, travail: () => Promise<{ error: { message?: string } | null }>, succes?: string) {
    setErreur('')
    setInfo('')
    setEnCours(cle)
    const { error } = await travail()
    setEnCours(null)
    if (error) {
      console.error(`[equipe] ${cle} :`, error)
      setErreur(messageErreurEquipe(error))
      return false
    }
    if (succes) setInfo(succes)
    await recharger()
    return true
  }

  // --- Créer l'équipe ---
  async function creerEquipe(e: React.FormEvent) {
    e.preventDefault()
    if (!nomEquipe.trim()) return
    await action('creer', async () => supabase.rpc('creer_equipe', { p_nom: nomEquipe.trim() }),
      `🎉 Équipe créée ! Votre essai gratuit de ${JOURS_ESSAI} jours commence maintenant.`)
  }

  // --- Inviter (ou ré-inviter) ---
  async function inviter(email: string, role: Role) {
    if (!equipe) return
    setErreur('')
    setInfo('')
    setEnCours(`inviter-${email}`)
    const { data, error } = await supabase.rpc('inviter_membre', { p_email: email, p_role: role })
    setEnCours(null)
    if (error || !data) {
      console.error('[equipe] Invitation impossible :', error)
      setErreur(messageErreurEquipe(error))
      return
    }
    const lien = lienInvitation(String(data))
    const { objet, corps } = emailInvitation(equipe.nom, role, email, lien, finEmail(profil))
    setInvitationPrete({ email, role, lien, objet, corps })
    setCopie(null)
    setEmailInvite('')
    await recharger()
    // On amène l'écran sur le bloc d'envoi
    setTimeout(() => document.getElementById('envoi-invitation')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  async function copier(texte: string, quoi: 'lien' | 'texte') {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(quoi)
    } catch {
      setErreur('La copie automatique a échoué : sélectionnez le texte et faites Ctrl+C.')
    }
  }

  async function copierLienInvitation(inv: Invitation) {
    try {
      await navigator.clipboard.writeText(lienInvitation(inv.jeton))
      setInfo(`📋 Lien d’invitation de ${inv.email} copié.`)
    } catch {
      setErreur('La copie automatique a échoué.')
    }
  }

  // --- Gestion des membres ---
  async function changerRole(m: Membre, role: Role) {
    if (m.est_moi && m.role === 'admin' && role !== 'admin'
      && !window.confirm('Vous ne serez plus Admin : vous ne pourrez plus inviter ni gérer l’équipe. Continuer ?')) return
    await action(`role-${m.user_id}`, async () => supabase.rpc('changer_role', { p_user: m.user_id, p_role: role }),
      `✅ ${m.nom} est maintenant ${infoRole(role).libelle}.`)
  }

  async function retirer(m: Membre) {
    if (!window.confirm(`Retirer ${m.nom} de l’équipe ?\n\nSes diagnostics restent à lui, mais ne seront plus partagés avec l’équipe.`)) return
    await action(`retirer-${m.user_id}`, async () => supabase.rpc('retirer_membre', { p_user: m.user_id }),
      `${m.nom} a été retiré(e) de l’équipe.`)
  }

  async function quitter(moi: Membre) {
    if (!window.confirm('Quitter l’équipe ?\n\nVos diagnostics restent à vous, mais ne seront plus partagés, et vous ne verrez plus ceux de l’équipe.')) return
    await action('quitter', async () => supabase.rpc('retirer_membre', { p_user: moi.user_id }), 'Vous avez quitté l’équipe.')
  }

  async function annulerInvitation(inv: Invitation) {
    if (!window.confirm(`Annuler l’invitation de ${inv.email} ? Le lien ne fonctionnera plus.`)) return
    if (invitationPrete?.email === inv.email) setInvitationPrete(null)
    await action(`annuler-${inv.id}`, async () => supabase.rpc('annuler_invitation', { p_id: inv.id }), 'Invitation annulée.')
  }

  async function renommer(e: React.FormEvent) {
    e.preventDefault()
    if (renommage === null || !renommage.trim()) return
    const ok = await action('renommer', async () => supabase.rpc('renommer_equipe', { p_nom: renommage.trim() }), '✅ Équipe renommée.')
    if (ok) setRenommage(null)
  }

  // --- Affichage ---
  if (chargement) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black text-gray-400">
        <Spinner /> <span className="ml-3">Chargement…</span>
      </main>
    )
  }

  const estAdmin = equipe?.mon_role === 'admin'
  const moi = membres.find((m) => m.est_moi)
  const licence = equipe ? etatLicence(equipe) : null
  const placesPrises = equipe ? equipe.places_utilisees + equipe.places_reservees : 0
  const placesPleines = equipe ? placesPrises >= equipe.places_max : false
  const roleInvitePayant = infoRole(roleInvite).payant
  const emailValide = EMAIL_VALIDE.test(emailInvite.trim())
  const peutInviter = Boolean(equipe?.active && emailValide && !(roleInvitePayant && placesPleines) && !enCours)

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black px-4 pb-20 pt-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between border-b border-gray-800 pb-6">
          <a href="/dashboard" className="text-lg font-bold text-blue-400">Diagnostic IA</a>
          <nav className="flex gap-4 text-sm text-gray-400">
            <a href="/dashboard/settings" className="transition hover:text-white">⚙️ Paramètres</a>
            <a href="/dashboard" className="transition hover:text-white">← Tableau de bord</a>
          </nav>
        </header>

        <h1 className="text-3xl font-bold sm:text-4xl">👥 Équipe</h1>
        <p className="mt-3 text-gray-400">Travaillez à plusieurs : invitez vos consultants et partagez vos diagnostics.</p>

        {/* Messages */}
        <div aria-live="polite">
          {info && <p role="status" className="mt-6 rounded-lg border border-green-700 bg-green-950/60 p-4 text-sm text-green-200">{info}</p>}
        </div>
        {erreur && <p role="alert" className="mt-6 rounded-lg border border-red-700 bg-red-950/70 p-4 text-sm text-red-200">⚠️ {erreur}</p>}

        {indisponible && (
          <p role="alert" className="mt-6 rounded-lg border border-amber-600 bg-amber-950/60 p-4 text-sm text-amber-100">
            ⚙️ La fonction Équipe n’est pas encore installée : exécutez le fichier <code className="font-mono">supabase/07_equipes.sql</code> dans Supabase (SQL Editor), puis rechargez la page.
          </p>
        )}

        {/* ============ PAS ENCORE D'ÉQUIPE ============ */}
        {!equipe && !indisponible && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
            <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <h2 className="text-xl font-semibold">Créer votre équipe</h2>
              <p className="mt-2 text-sm text-gray-400">Vous en serez l’Admin. Vos diagnostics actuels restent privés : c’est vous qui choisissez lesquels partager.</p>
              <form onSubmit={creerEquipe} className="mt-5">
                <label className="block text-sm font-medium text-gray-200">
                  Nom de l’équipe
                  <input className={inputClass} value={nomEquipe} maxLength={120} placeholder="ex. : Cabinet Martin Conseil"
                    onChange={(e) => setNomEquipe(e.target.value)} />
                </label>
                <button type="submit" disabled={!nomEquipe.trim() || enCours === 'creer'}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {enCours === 'creer' && <Spinner />} Créer mon équipe — {JOURS_ESSAI} jours gratuits
                </button>
              </form>
              <div className="mt-6 space-y-3 border-t border-gray-700 pt-5">
                <p className="text-sm font-medium text-gray-200">Les 3 rôles :</p>
                {ROLES.map((r) => (
                  <p key={r.valeur} className="text-sm text-gray-300">
                    <BadgeRole role={r.valeur} /> <span className="ml-1">{r.description}</span>
                  </p>
                ))}
              </div>
              <p className="mt-6 rounded-lg bg-gray-900 p-4 text-sm text-gray-400">
                📩 Vous avez reçu une invitation ? Ouvrez simplement le lien reçu par email.
              </p>
            </section>

            {/* Carte tarif */}
            <aside className="rounded-xl border border-blue-700 bg-gradient-to-b from-blue-950/60 to-gray-800 p-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-300">Offre Équipe</p>
              <p className="mt-2 text-4xl font-bold">{PRIX_OFFRE_EQUIPE} €<span className="text-base font-medium text-gray-300"> / mois</span></p>
              <ul className="mt-5 space-y-2 text-sm text-gray-200">
                <li>✓ {PLACES_OFFRE_EQUIPE} places Admin ou Consultant</li>
                <li>✓ Viewers illimités et gratuits</li>
                <li>✓ Partage des diagnostics en 1 clic</li>
                <li>✓ Rôles et droits d’accès</li>
                <li>✓ {ANALYSES_IA_INCLUSES} analyses IA par mois et par consultant</li>
                <li>✓ {JOURS_ESSAI} jours d’essai gratuit du partage, sans carte bancaire ({ANALYSES_OFFERTES_ESSAI} analyses IA offertes par personne)</li>
              </ul>
            </aside>
          </div>
        )}

        {/* ============ MON ÉQUIPE ============ */}
        {equipe && licence && (
          <div className="mt-8 space-y-6">
            {/* En-tête : nom + licence + places */}
            <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {renommage === null ? (
                    <h2 className="flex flex-wrap items-center gap-3 text-2xl font-bold">
                      {equipe.nom}
                      {estAdmin && (
                        <button type="button" onClick={() => setRenommage(equipe.nom)} className="text-xs font-normal text-gray-400 underline hover:text-white">
                          ✏️ Renommer
                        </button>
                      )}
                    </h2>
                  ) : (
                    <form onSubmit={renommer} className="flex flex-wrap items-end gap-2">
                      <label className="text-sm text-gray-300">
                        Nouveau nom
                        <input className={`${inputClass} mt-1`} value={renommage} maxLength={120} autoFocus
                          onChange={(e) => setRenommage(e.target.value)} />
                      </label>
                      <button type="submit" disabled={!renommage.trim() || enCours === 'renommer'} className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">OK</button>
                      <button type="button" onClick={() => setRenommage(null)} className="rounded-lg border border-gray-600 px-4 py-3 text-sm text-gray-300">Annuler</button>
                    </form>
                  )}
                  <p className="mt-2 text-sm text-gray-400">Votre rôle : <BadgeRole role={equipe.mon_role} /></p>
                </div>
                <div className={`rounded-lg border p-4 text-sm sm:max-w-xs ${licence.ton === 'vert' ? 'border-green-800 bg-green-950/40' : licence.ton === 'orange' ? 'border-amber-600 bg-amber-950/40' : 'border-red-700 bg-red-950/40'}`}>
                  <p className="font-semibold">{licence.titre}</p>
                  {/* Avec un abonnement Stripe, la phrase de Stripe (prochain prélèvement…) est plus claire */}
                  {!(estAdmin && abonnementEnCours(abonnement)) && <p className="mt-1 text-gray-300">{licence.detail}</p>}

                  {estAdmin && abonnement?.statut && (
                    <p className={`mt-2 ${texteAbonnement(abonnement).ton === 'rouge' ? 'font-semibold text-red-200' : texteAbonnement(abonnement).ton === 'orange' ? 'text-amber-200' : 'text-gray-300'}`}>
                      {texteAbonnement(abonnement).texte}
                    </p>
                  )}

                  {/* 💳 Payer (pas encore d'abonnement) */}
                  {estAdmin && !abonnementEnCours(abonnement) && !equipe.licence_active && (
                    <>
                      <button type="button" onClick={payer} disabled={paiement !== null}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold transition hover:bg-blue-700 disabled:opacity-50">
                        {paiement === 'payer' ? <Spinner /> : <span aria-hidden>💳</span>}
                        {paiement === 'payer' ? 'Ouverture de Stripe…' : `Activer l’offre Équipe — ${PRIX_OFFRE_EQUIPE} €/mois`}
                      </button>
                      <p className="mt-2 text-xs text-gray-400">
                        🔒 Paiement sécurisé par Stripe, sans engagement.
                        {equipe.active && joursRestants(equipe.essai_jusqu_au) > 2 && ' Rien n’est prélevé avant la fin de votre essai gratuit.'}
                      </p>
                      {secoursEmail && (
                        <a href={lienDemandeActivation(equipe)} className="mt-2 inline-block text-xs text-blue-300 underline">
                          Ou demander l’activation par email
                        </a>
                      )}
                    </>
                  )}

                  {/* 🧾 Gérer (abonnement existant : factures, carte, résiliation) */}
                  {estAdmin && abonnement?.stripe_customer_id && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {(abonnementEnCours(abonnement) || abonnement.statut) && (
                        <button type="button" onClick={gererAbonnement} disabled={paiement !== null}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-500 px-3 py-2 text-xs font-semibold text-gray-100 transition hover:border-gray-300 disabled:opacity-50">
                          {paiement === 'portail' ? <Spinner /> : <span aria-hidden>🧾</span>}
                          {abonnementEnCours(abonnement) ? 'Gérer mon abonnement' : 'Mes factures'}
                        </button>
                      )}
                      <button type="button" onClick={actualiser} disabled={paiement !== null}
                        className="text-xs text-gray-400 underline transition hover:text-white disabled:opacity-50">
                        {paiement === 'actualiser' ? 'Actualisation…' : '🔄 Actualiser'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Places */}
              <div className="mt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <p className="font-medium">
                    {placesPrises} / {equipe.places_max} places utilisées
                    <span className="font-normal text-gray-400"> (Admin + Consultants{equipe.places_reservees > 0 ? `, dont ${equipe.places_reservees} invitation${equipe.places_reservees > 1 ? 's' : ''} en attente` : ''})</span>
                  </p>
                  <p className="text-gray-400">👁️ {equipe.viewers} Viewer{equipe.viewers > 1 ? 's' : ''} (gratuits)</p>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-700" role="progressbar"
                  aria-valuemin={0} aria-valuemax={equipe.places_max} aria-valuenow={Math.min(placesPrises, equipe.places_max)}
                  aria-label="Places utilisées">
                  <div className={`h-full rounded-full ${placesPleines ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (placesPrises / Math.max(1, equipe.places_max)) * 100)}%` }} />
                </div>
              </div>
            </section>

            {/* Inviter (Admin) */}
            {estAdmin && (
              <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <h2 className="text-lg font-semibold">✉️ Inviter une personne</h2>
                <p className="mt-1 text-sm text-gray-400">L’outil crée un lien d’invitation personnel (valable 7 jours) que vous envoyez par email.</p>

                {!equipe.active ? (
                  <p className="mt-4 rounded-lg bg-gray-900 p-4 text-sm text-gray-300">⛔ Les invitations sont en pause tant que l’offre Équipe n’est pas activée.</p>
                ) : (
                  <form className="mt-5 space-y-5" onSubmit={(e) => { e.preventDefault(); if (peutInviter) inviter(emailInvite.trim().toLowerCase(), roleInvite) }}>
                    <label className="block text-sm font-medium text-gray-200">
                      Adresse email de la personne
                      <input type="email" className={inputClass} value={emailInvite} maxLength={200} placeholder="ex. : prenom@cabinet.fr"
                        aria-describedby="aide-email-invite" onChange={(e) => setEmailInvite(e.target.value)} />
                      <span id="aide-email-invite" className={`mt-1 block text-xs ${emailInvite && !emailValide ? 'text-amber-300' : 'text-gray-400'}`}>
                        {!emailInvite ? '✍️ Elle devra se connecter avec cette même adresse.' : emailValide ? '✓ Adresse valide' : 'Adresse incomplète (ex. : prenom@cabinet.fr)'}
                      </span>
                    </label>

                    <fieldset>
                      <legend className="text-sm font-medium text-gray-200">Rôle</legend>
                      <div className="mt-2 grid gap-3 sm:grid-cols-3">
                        {ROLES.map((r) => {
                          const bloque = r.payant && placesPleines
                          return (
                            <label key={r.valeur}
                              className={`cursor-pointer rounded-lg border p-3 text-sm transition focus-within:ring-2 focus-within:ring-blue-400 ${roleInvite === r.valeur ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-400'} ${bloque ? 'opacity-50' : ''}`}>
                              <input type="radio" name="role" className="sr-only" value={r.valeur} checked={roleInvite === r.valeur}
                                onChange={() => setRoleInvite(r.valeur)} />
                              <span className="font-semibold">{r.emoji} {r.libelle}</span>
                              <span className={`ml-2 text-xs ${r.payant ? 'text-gray-400' : 'text-green-400'}`}>{r.payant ? '1 place' : 'gratuit'}</span>
                              <span className="mt-1 block text-xs text-gray-400">{r.description}</span>
                            </label>
                          )
                        })}
                      </div>
                      {roleInvitePayant && placesPleines && (
                        <p className="mt-2 text-xs text-amber-300">Plus de place libre : invitez en Viewer (gratuit), annulez une invitation ou retirez un membre.</p>
                      )}
                    </fieldset>

                    <button type="submit" disabled={!peutInviter}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {enCours?.startsWith('inviter-') && <Spinner />} ✉️ Créer l’invitation
                    </button>
                  </form>
                )}

                {/* L'invitation est prête : 3 façons de l'envoyer */}
                {invitationPrete && (
                  <div id="envoi-invitation" className="mt-6 rounded-xl border border-green-700 bg-green-950/40 p-5">
                    <p className="font-semibold text-green-200">✅ Invitation prête pour {invitationPrete.email} ({infoRole(invitationPrete.role).libelle})</p>
                    <p className="mt-1 text-sm text-gray-300">Choisissez comment l’envoyer :</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={lienMailto(invitationPrete.email, invitationPrete.objet, invitationPrete.corps)}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-blue-700">📧 Ma messagerie</a>
                      <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invitationPrete.email)}&su=${encodeURIComponent(invitationPrete.objet)}&body=${encodeURIComponent(invitationPrete.corps)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="rounded-lg border border-gray-500 px-4 py-2.5 text-sm font-semibold transition hover:border-gray-300">✉️ Gmail</a>
                      <button type="button" onClick={() => copier(invitationPrete.corps, 'texte')}
                        className="rounded-lg border border-gray-500 px-4 py-2.5 text-sm font-semibold transition hover:border-gray-300">
                        {copie === 'texte' ? '✓ Texte copié' : '📋 Copier le texte'}
                      </button>
                      <button type="button" onClick={() => copier(invitationPrete.lien, 'lien')}
                        className="rounded-lg border border-gray-500 px-4 py-2.5 text-sm font-semibold transition hover:border-gray-300">
                        {copie === 'lien' ? '✓ Lien copié' : '🔗 Copier le lien seul'}
                      </button>
                    </div>
                    <p className="mt-3 break-all rounded bg-gray-900 p-2 font-mono text-xs text-gray-400">{invitationPrete.lien}</p>
                  </div>
                )}
              </section>
            )}

            {/* Membres */}
            <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <h2 className="text-lg font-semibold">Membres ({membres.length})</h2>
              <ul className="mt-4 divide-y divide-gray-700">
                {membres.map((m) => (
                  <li key={m.user_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-700 font-semibold uppercase">
                        {(m.nom || m.email || '?').charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.nom}{m.est_moi && <span className="ml-2 text-xs text-gray-400">(vous)</span>}</p>
                        <p className="truncate text-xs text-gray-400">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {estAdmin ? (
                        <label className="text-xs text-gray-400">
                          <span className="sr-only">Rôle de {m.nom}</span>
                          <select value={m.role} disabled={enCours === `role-${m.user_id}`}
                            onChange={(e) => changerRole(m, e.target.value as Role)}
                            className="rounded-lg border border-gray-500 bg-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                            {ROLES.map((r) => <option key={r.valeur} value={r.valeur}>{r.emoji} {r.libelle}</option>)}
                          </select>
                        </label>
                      ) : (
                        <BadgeRole role={m.role} />
                      )}
                      {estAdmin && !m.est_moi && (
                        <button type="button" onClick={() => retirer(m)} disabled={enCours === `retirer-${m.user_id}`}
                          className={`${boutonSecondaire} hover:border-red-700 hover:text-red-300`}>Retirer</button>
                      )}
                      {m.est_moi && (
                        <button type="button" onClick={() => quitter(m)} disabled={enCours === 'quitter'}
                          className={`${boutonSecondaire} hover:border-red-700 hover:text-red-300`}>Quitter l’équipe</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Invitations en attente (Admin) */}
            {estAdmin && invitations.length > 0 && (
              <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <h2 className="text-lg font-semibold">Invitations en attente ({invitations.length})</h2>
                <ul className="mt-4 divide-y divide-gray-700">
                  {invitations.map((inv) => {
                    const jours = joursRestants(inv.expires_at)
                    return (
                      <li key={inv.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{inv.email} <BadgeRole role={inv.role} /></p>
                          <p className={`text-xs ${jours > 0 ? 'text-gray-400' : 'text-amber-300'}`}>
                            {jours > 0 ? `⏳ Expire dans ${jours} jour${jours > 1 ? 's' : ''}` : '⌛ Expirée : renvoyez-la pour la prolonger'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {jours > 0 && (
                            <button type="button" onClick={() => copierLienInvitation(inv)} className={boutonSecondaire}>🔗 Copier le lien</button>
                          )}
                          <button type="button" onClick={() => inviter(inv.email, inv.role)} disabled={Boolean(enCours) || !equipe.active} className={boutonSecondaire}
                            title="Prolonge l’invitation de 7 jours et prépare un nouvel email">🔁 Renvoyer</button>
                          <button type="button" onClick={() => annulerInvitation(inv)} disabled={enCours === `annuler-${inv.id}`}
                            className={`${boutonSecondaire} hover:border-red-700 hover:text-red-300`}>✖ Annuler</button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* Mode d'emploi */}
            <details className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <summary className="cursor-pointer font-semibold">ℹ️ Comment ça marche ?</summary>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-300">
                <li>L’Admin invite une personne avec son adresse email et choisit son rôle.</li>
                <li>La personne ouvre le lien, se connecte (ou crée son compte) avec <strong>la même adresse email</strong>, puis clique sur « Rejoindre l’équipe ».</li>
                <li>Chaque diagnostic reste <strong>privé</strong>. Pour le partager, cliquez sur <strong>👥</strong> dans votre tableau de bord.</li>
                <li>Les diagnostics partagés apparaissent chez tous les membres, dans « Partagés par votre équipe » (lecture seule ; l’Admin peut les modifier).</li>
              </ol>
              <div className="mt-4 space-y-2 border-t border-gray-700 pt-4">
                {ROLES.map((r) => (
                  <p key={r.valeur} className="text-sm text-gray-300"><BadgeRole role={r.valeur} /> <span className="ml-1">{r.description}</span></p>
                ))}
              </div>
            </details>

            {moi && !estAdmin && (
              <p className="text-center text-xs text-gray-500">Pour inviter quelqu’un ou changer un rôle, demandez à un Admin de l’équipe.</p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
