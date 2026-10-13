'use client'

// Bouton "Télécharger en PDF" : ouvre la fenêtre d'impression du navigateur,
// où l'on choisit « Enregistrer au format PDF ». Pas besoin de logiciel en plus.
export default function BoutonImprimer({ className = '' }: { className?: string }) {
  function imprimer() {
    // On déplie les blocs repliés (<details>) pour qu'ils apparaissent dans le PDF
    document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''))
    window.print()
  }
  return (
    <button type="button" onClick={imprimer}
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-400 px-4 py-2.5 text-sm font-semibold text-gray-100 transition hover:border-white print:hidden ${className}`}>
      📥 Télécharger en PDF
    </button>
  )
}
