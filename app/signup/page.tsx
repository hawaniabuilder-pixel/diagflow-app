'use client'

// Page d'INSCRIPTION.
// Après l'inscription, Supabase envoie un email de confirmation : on l'explique clairement à l'écran.
import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { avecSuite, lireSuite, sAbonnerAucunChangement } from '../lib/redirection'
import { champAuth, traduireErreurAuth } from '../lib/erreurs-auth'

export default function SignupPage() {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailEnvoye, setEmailEnvoye] = useState(false)
  const router = useRouter()
  // Page où revenir après l'inscription (ex. une invitation d'équipe)
  const suite = useSyncExternalStore(sAbonnerAucunChangement, lireSuite, () => null)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Mot de passe trop court : au moins 8 caractères.')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nom_complet: nom.trim() },
        // Le lien de l'email de confirmation ramène sur la page de connexion de CE site
        emailRedirectTo: `${window.location.origin}${avecSuite('/login', suite)}`,
      },
    })
    setLoading(false)
    if (error) {
      setError(traduireErreurAuth(error.message))
      return
    }
    // Si la confirmation par email est désactivée dans Supabase, on est déjà connecté
    if (data.session) {
      router.push(suite ?? '/dashboard')
      return
    }
    setEmailEnvoye(true)
  }

  if (emailEnvoye) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white">
        <div className="w-full max-w-md rounded-xl bg-gray-800 p-8 text-center shadow-lg">
          <p className="text-5xl" aria-hidden>📩</p>
          <h1 className="mt-4 text-2xl font-bold">Vérifiez votre boîte mail</h1>
          <p className="mt-3 text-gray-300">
            Un email de confirmation a été envoyé à <strong className="text-white">{email.trim()}</strong>.
            Cliquez sur le lien qu’il contient pour activer votre compte.
          </p>
          <p className="mt-3 text-sm text-gray-400">Rien reçu après 2 minutes ? Regardez dans les spams.</p>
          <a href={avecSuite('/login', suite)} className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700">
            Aller à la connexion
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white">
      <div className="w-full max-w-md rounded-xl bg-gray-800 p-8 shadow-lg">
        <a href="/" className="block text-center text-sm font-semibold text-blue-400">Vizion</a>
        <h1 className="mb-8 mt-2 text-center text-3xl font-bold">Créer un compte</h1>

        {suite?.startsWith('/invitation/') && (
          <div className="mb-4 rounded-lg border border-blue-700 bg-blue-950 p-3 text-sm text-blue-100">
            👥 Créez votre compte avec l’adresse email qui a reçu l’invitation.
          </div>
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200">⚠️ {error}</p>
        )}

        <form className="space-y-5" onSubmit={handleSignup}>
          <div>
            <label htmlFor="nom" className="mb-2 block text-gray-300">Nom complet</label>
            <input id="nom" type="text" autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)}
              className={champAuth} placeholder="ex. : Jean Dupont" required />
          </div>
          <div>
            <label htmlFor="email" className="mb-2 block text-gray-300">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={champAuth} placeholder="ex. : prenom@cabinet.fr" required />
          </div>
          <div>
            <label htmlFor="mot-de-passe" className="mb-2 block text-gray-300">Mot de passe</label>
            <input id="mot-de-passe" type="password" autoComplete="new-password" minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} className={champAuth} placeholder="8 caractères minimum" required
              aria-describedby="aide-mot-de-passe" />
            <p id="aide-mot-de-passe" className="mt-1 text-xs text-gray-400">Au moins 8 caractères, avec des lettres et des chiffres.</p>
          </div>

          <p className="text-xs text-gray-400">
            En créant un compte, vous acceptez les{' '}
            <a href="/cgv" target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">conditions générales</a>{' '}
            et la{' '}
            <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">politique de confidentialité</a>.
          </p>

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Inscription…' : 'S’inscrire'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-400">
          Déjà un compte ?{' '}
          <a href={avecSuite('/login', suite)} className="text-blue-400 hover:underline">Se connecter</a>
        </p>
      </div>
    </div>
  )
}
