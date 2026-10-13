// Pied de page avec les liens légaux (accueil, tableau de bord, pages légales).
// Obligatoire en France : les mentions légales doivent être accessibles depuis toutes les pages publiques.
import { ENTREPRISE, estACompleter } from '../lib/entreprise'

const LIENS = [
  { href: '/mentions-legales', texte: 'Mentions légales' },
  { href: '/cgv', texte: 'CGU / CGV' },
  { href: '/confidentialite', texte: 'Confidentialité' },
]

export default function PiedDePageLegal({ className = '' }: { className?: string }) {
  const contact = estACompleter(ENTREPRISE.email) ? null : ENTREPRISE.email
  return (
    <footer className={`border-t border-gray-800 py-8 text-center text-sm text-gray-400 ${className}`}>
      <nav aria-label="Informations légales" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {LIENS.map((l) => (
          <a key={l.href} href={l.href} className="transition hover:text-white">{l.texte}</a>
        ))}
        {contact && <a href={`mailto:${contact}`} className="transition hover:text-white">Contact</a>}
      </nav>
      <p className="mt-3 text-xs text-gray-500" suppressHydrationWarning>© {new Date().getFullYear()} {ENTREPRISE.nomCommercial}. Tous droits réservés.</p>
    </footer>
  )
}
