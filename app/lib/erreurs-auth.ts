// Messages de Supabase (en anglais) traduits en phrases simples, pour la connexion,
// l'inscription et le mot de passe oublié.

export function traduireErreurAuth(message?: string | null): string {
  const m = (message ?? '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (m.includes('email not confirmed')) return 'Votre email n’est pas encore confirmé : cliquez sur le lien reçu par email (pensez à regarder dans les spams).'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet email. Connectez-vous, ou utilisez « Mot de passe oublié ».'
  if (m.includes('different from the old')) return 'Le nouveau mot de passe doit être différent de l’ancien.'
  if (m.includes('password') && (m.includes('at least') || m.includes('weak') || m.includes('short'))) {
    return 'Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.'
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Trop de tentatives. Patientez une minute, puis réessayez.'
  if (m.includes('expired') || (m.includes('invalid') && (m.includes('token') || m.includes('link') || m.includes('otp')))) {
    return 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien.'
  }
  if (m.includes('signup') && m.includes('disabled')) return 'Les inscriptions sont fermées pour le moment.'
  if (m.includes('invalid') && m.includes('email')) return 'Adresse email invalide.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Connexion impossible. Vérifiez votre connexion internet.'
  return 'Une erreur est survenue. Réessayez dans un instant.'
}

// Adresse de la page « nouveau mot de passe » : celle du site actuel
// (localhost sur votre ordinateur, votre vrai nom de domaine une fois en ligne)
export const lienNouveauMotDePasse = () => `${window.location.origin}/reset-password`

// Style commun des pages de connexion
export const champAuth =
  'w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder:italic placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500'
