// Après la connexion ou l'inscription : où renvoyer la personne ?
// Exemple : /login?suite=/invitation/xxxx → après connexion, on ouvre l'invitation.

export function lireSuite(): string | null {
  if (typeof window === 'undefined') return null
  const suite = new URLSearchParams(window.location.search).get('suite')
  // Sécurité : uniquement une page de CE site (commence par "/", mais pas "//" qui mènerait ailleurs)
  return suite && suite.startsWith('/') && !suite.startsWith('//') && !suite.includes('\\') ? suite : null
}

// "/login" + suite → "/login?suite=%2Finvitation%2Fxxxx"
export function avecSuite(page: string, suite: string | null) {
  return suite ? `${page}?suite=${encodeURIComponent(suite)}` : page
}

// Pour useSyncExternalStore : l'adresse ne change pas pendant qu'on est sur la page
export const sAbonnerAucunChangement = () => () => {}
