'use client'

// Page d'INVITATION : la personne invitée ouvre ce lien pour rejoindre une équipe.
// Adresse : /invitation/<jeton secret>
// Elle doit être connectée avec LA MÊME adresse email que celle de l'invitation.

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { infoRole, messageErreurEquipe, type Role } from '../../lib/equipe'
import { avecSuite } from '../../lib/redirection'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type DetailInvitation = {
  equipe_nom: string
  role: Role
  email: string
  invite_par_nom: string
  expiree: boolean
  deja_acceptee: boolean
  email_correspond: boolean
  deja_dans_une_equipe: boolean
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 py-10 text-white">
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-800 p-6 sm:p-8">
        <p className="text-lg font-bold text-blue-400">Vizion</p>
        {children}
      </div>
    </main>
  )
}

export default function InvitationPage() {
  const router = useRouter()
  const { jeton } = useParams<{ jeton: string }>()
  const [chargement, setChargement] = useState(true)
  const [invitation, setInvitation] = useState<DetailInvitation | null>(null)
  const [emailConnecte, setEmailConnecte] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [acceptation, setAcceptation] = useState(false)
  const [rejoint, setRejoint] = useState(false)

  const jetonValide = UUID.test(jeton ?? '')

  const charger = useCallback(async () => {
    if (!UUID.test(jeton ?? '')) return // lien abîmé : rien à charger
    const { data: { session } } = await supabase.auth.getSession()
    setEmailConnecte(session?.user.email ?? null)
    const { data, error } = await supabase.rpc('voir_invitation', { p_jeton: jeton })
    if (error) {
      console.error('[invitation] Lecture impossible :', error)
      setErreur(messageErreurEquipe(error))
    }
    const ligne = Array.isArray(data) ? data[0] : data
    setInvitation((ligne as DetailInvitation) ?? null)
    setChargement(false)
  }, [jeton])

  useEffect(() => { charger() }, [charger])

  const ici = `/invitation/${jeton}`

  async function accepter() {
    setErreur('')
    setAcceptation(true)
    const { error } = await supabase.rpc('accepter_invitation', { p_jeton: jeton })
    setAcceptation(false)
    if (error) {
      console.error('[invitation] Acceptation impossible :', error)
      setErreur(messageErreurEquipe(error))
      return
    }
    setRejoint(true)
  }

  async function changerDeCompte() {
    await supabase.auth.signOut()
    router.push(avecSuite('/login', ici))
  }

  if (chargement && jetonValide) {
    return <Cadre><p className="mt-6 text-gray-400">Chargement de l’invitation…</p></Cadre>
  }

  // Lien abîmé ou invitation annulée
  if (!invitation) {
    return (
      <Cadre>
        <h1 className="mt-4 text-2xl font-bold">Invitation introuvable</h1>
        <p className="mt-3 text-gray-300">Ce lien n’est pas valable : l’invitation a peut-être été annulée. Demandez un nouveau lien à la personne qui vous a invité(e).</p>
        {erreur && <p role="alert" className="mt-4 text-sm text-red-300">⚠️ {erreur}</p>}
      </Cadre>
    )
  }

  const role = infoRole(invitation.role)

  if (rejoint) {
    return (
      <Cadre>
        <h1 className="mt-4 text-2xl font-bold">🎉 Bienvenue dans l’équipe « {invitation.equipe_nom} » !</h1>
        <p className="mt-3 text-gray-300">Vous êtes maintenant {role.emoji} {role.libelle}. {role.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/dashboard" className="rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold transition hover:bg-orange-600">Aller au tableau de bord</a>
          <a href="/dashboard/equipe" className="rounded-lg border border-gray-500 px-5 py-3 text-sm font-semibold transition hover:border-gray-300">👥 Voir l’équipe</a>
        </div>
      </Cadre>
    )
  }

  return (
    <Cadre>
      <p className="mt-4 text-sm text-gray-400">{invitation.invite_par_nom} vous invite à rejoindre</p>
      <h1 className="mt-1 text-2xl font-bold">👥 L’équipe « {invitation.equipe_nom} »</h1>
      <div className="mt-4 rounded-lg bg-gray-900 p-4 text-sm">
        <p className="font-semibold">Votre rôle : {role.emoji} {role.libelle}</p>
        <p className="mt-1 text-gray-300">{role.description}</p>
      </div>

      {erreur && <p role="alert" className="mt-4 rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200">⚠️ {erreur}</p>}

      {invitation.deja_acceptee ? (
        <p className="mt-6 text-gray-300">✅ Cette invitation a déjà été utilisée. <a href="/dashboard" className="text-blue-400 underline">Aller au tableau de bord</a></p>
      ) : invitation.expiree ? (
        <p className="mt-6 text-amber-200">⌛ Cette invitation a expiré. Demandez à {invitation.invite_par_nom} de vous la renvoyer.</p>
      ) : !emailConnecte ? (
        // Pas connecté : se connecter ou créer un compte, puis revenir ici automatiquement
        <div className="mt-6">
          <p className="text-sm text-gray-300">
            Pour accepter, connectez-vous (ou créez votre compte) avec l’adresse : <strong className="text-white">{invitation.email}</strong>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={avecSuite('/login', ici)} className="rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold transition hover:bg-orange-600">Se connecter</a>
            <a href={avecSuite('/signup', ici)} className="rounded-lg border border-gray-500 px-5 py-3 text-sm font-semibold transition hover:border-gray-300">Créer un compte</a>
          </div>
          <p className="mt-4 text-xs text-gray-400">Nouveau compte ? Après avoir confirmé votre email, revenez sur ce lien pour terminer.</p>
        </div>
      ) : !invitation.email_correspond ? (
        <div className="mt-6">
          <p className="text-sm text-amber-200">
            Vous êtes connecté avec <strong>{emailConnecte}</strong>, mais cette invitation est pour <strong>{invitation.email}</strong>.
          </p>
          <button type="button" onClick={changerDeCompte}
            className="mt-4 rounded-lg border border-gray-500 px-5 py-3 text-sm font-semibold transition hover:border-gray-300">
            Me déconnecter et changer de compte
          </button>
        </div>
      ) : invitation.deja_dans_une_equipe ? (
        <p className="mt-6 text-sm text-amber-200">
          Vous faites déjà partie d’une équipe. Pour rejoindre celle-ci, quittez d’abord l’autre depuis la page <a href="/dashboard/equipe" className="underline">👥 Équipe</a>, puis revenez sur ce lien.
        </p>
      ) : (
        <div className="mt-6">
          <p className="text-sm text-gray-400">Connecté : {emailConnecte}</p>
          <button type="button" onClick={accepter} disabled={acceptation}
            className="mt-3 w-full rounded-lg bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-700 disabled:opacity-50">
            {acceptation ? 'Un instant…' : '✅ Rejoindre l’équipe'}
          </button>
        </div>
      )}
    </Cadre>
  )
}
