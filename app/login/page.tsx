'use client'

// Page de CONNEXION.
// Après la connexion, on revient à la page demandée (ex. une invitation d'équipe), sinon au tableau de bord.
import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { avecSuite, lireSuite, sAbonnerAucunChangement } from '../lib/redirection'
import { champAuth, traduireErreurAuth } from '../lib/erreurs-auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [voirMotDePasse, setVoirMotDePasse] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  // Page où revenir après la connexion (ex. une invitation d'équipe), sinon le tableau de bord
  const suite = useSyncExternalStore(sAbonnerAucunChangement, lireSuite, () => null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setLoading(false)
      setError(traduireErreurAuth(error.message))
      return
    }
    // Plus de fenêtre « Connexion réussie ! » qui bloque l'écran : on part directement
    router.push(suite ?? '/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-black px-4 text-white">
      <div className="w-full max-w-md rounded-xl bg-gray-800 p-8 shadow-lg">
        <a href="/" className="block text-center text-sm font-semibold text-blue-400">Vizion</a>
        <h1 className="mb-8 mt-2 text-center text-3xl font-bold">Connexion</h1>

        {suite && (
          <div className="mb-4 rounded-lg border border-blue-700 bg-blue-950 p-3 text-sm text-blue-100">
            {suite.startsWith('/invitation/')
              ? '👥 Connectez-vous pour accepter votre invitation d’équipe (avec l’adresse email invitée).'
              : '🔐 Connectez-vous pour continuer.'}
          </div>
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200">⚠️ {error}</p>
        )}

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="mb-2 block text-gray-300">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={champAuth} placeholder="ex. : prenom@cabinet.fr" required />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="mot-de-passe" className="block text-gray-300">Mot de passe</label>
              <a href="/forgot-password" className="text-sm text-blue-400 hover:underline">Mot de passe oublié ?</a>
            </div>
            <div className="relative">
              <input id="mot-de-passe" type={voirMotDePasse ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} className={`${champAuth} pr-24`} placeholder="••••••••" required />
              <button type="button" onClick={() => setVoirMotDePasse((v) => !v)}
                className="absolute inset-y-0 right-2 my-auto h-8 rounded px-2 text-xs text-gray-300 hover:text-white"
                aria-pressed={voirMotDePasse}>
                {voirMotDePasse ? '🙈 Cacher' : '👁️ Voir'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-400">
          Pas encore de compte ?{' '}
          <a href={avecSuite('/signup', suite)} className="text-blue-400 hover:underline">S’inscrire</a>
        </p>
      </div>
    </div>
  )
}
