'use client'

// NOUVEAU MOT DE PASSE : la page ouverte par le lien de l'email « Mot de passe oublié ».
// Cette page n'existait pas : le lien menait à une erreur 404.
//
// Comment ça marche : le lien contient un code secret. Supabase le lit tout seul et connecte
// la personne pour quelques minutes. Elle peut alors choisir un nouveau mot de passe.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { champAuth, traduireErreurAuth } from '../lib/erreurs-auth'

type Etat = 'verification' | 'pret' | 'invalide' | 'termine'

export default function ResetPasswordPage() {
  const [etat, setEtat] = useState<Etat>('verification')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [voir, setVoir] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let actif = true
    // Supabase prévient quand il a lu le lien de l'email
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evenement: string, session: unknown) => {
      if (!actif) return
      if (evenement === 'PASSWORD_RECOVERY' || (session && evenement === 'SIGNED_IN')) setEtat('pret')
    })

    async function verifier() {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const query = new URLSearchParams(window.location.search)

      // 1) Lien expiré ou déjà utilisé : Supabase l'indique dans l'adresse
      const erreurLien = hash.get('error_description') || query.get('error_description')
      if (erreurLien) {
        setError(traduireErreurAuth(erreurLien))
        setEtat('invalide')
        return
      }
      // 2) Certains réglages de Supabase envoient un « code » à échanger
      const code = query.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setError(traduireErreurAuth(error.message))
          setEtat('invalide')
          return
        }
      }
      // 3) La personne est-elle bien connectée grâce au lien ?
      const { data: { session } } = await supabase.auth.getSession()
      if (!actif) return
      if (session) {
        setEtat('pret')
        window.history.replaceState(null, '', '/reset-password') // on retire le code secret de l'adresse
        return
      }
      // On laisse 3 secondes à Supabase pour lire le lien, sinon le lien n'est pas valable
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession()
        if (actif && !data.session) setEtat((e) => (e === 'verification' ? 'invalide' : e))
      }, 3000)
    }
    verifier()

    return () => {
      actif = false
      subscription.unsubscribe()
    }
  }, [])

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Mot de passe trop court : au moins 8 caractères.')
      return
    }
    if (password !== confirmation) {
      setError('Les 2 mots de passe ne sont pas identiques.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(traduireErreurAuth(error.message))
      return
    }
    setEtat('termine')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white">
      <div className="w-full max-w-md rounded-xl bg-gray-800 p-8 shadow-lg">
        <a href="/" className="block text-center text-sm font-semibold text-blue-400">Diagnostic IA</a>
        <h1 className="mb-6 mt-2 text-center text-3xl font-bold">Nouveau mot de passe</h1>

        {etat === 'verification' && (
          <p role="status" className="text-center text-gray-300">Vérification du lien…</p>
        )}

        {etat === 'invalide' && (
          <div className="text-center">
            <p role="alert" className="rounded-lg border border-amber-600 bg-amber-950/60 p-4 text-sm text-amber-100">
              ⌛ {error || 'Ce lien n’est pas valable : il a peut-être expiré ou déjà servi.'}
            </p>
            <a href="/forgot-password" className="mt-5 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700">
              Recevoir un nouveau lien
            </a>
          </div>
        )}

        {etat === 'termine' && (
          <div className="text-center">
            <p role="status" className="rounded-lg border border-green-700 bg-green-950/60 p-4 text-green-100">
              ✅ Votre mot de passe a été changé. Vous êtes connecté.
            </p>
            <a href="/dashboard" className="mt-5 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700">
              Aller au tableau de bord
            </a>
          </div>
        )}

        {etat === 'pret' && (
          <form className="space-y-5" onSubmit={enregistrer}>
            {error && (
              <p role="alert" className="rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200">⚠️ {error}</p>
            )}
            <div>
              <label htmlFor="nouveau" className="mb-2 block text-gray-300">Nouveau mot de passe</label>
              <input id="nouveau" type={voir ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} className={champAuth} placeholder="8 caractères minimum" required />
            </div>
            <div>
              <label htmlFor="confirmation" className="mb-2 block text-gray-300">Retapez-le</label>
              <input id="confirmation" type={voir ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)} className={champAuth} placeholder="Le même mot de passe" required />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={voir} onChange={(e) => setVoir(e.target.checked)} className="h-4 w-4 accent-blue-500" />
              Afficher les mots de passe
            </label>
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
